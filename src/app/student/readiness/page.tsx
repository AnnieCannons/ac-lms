import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'
import ReadinessTracker from '@/components/ui/ReadinessTracker'

export const dynamic = 'force-dynamic'

function isCurrent(startDate: string | null | undefined, endDate?: string | null): boolean {
  if (!startDate) return false
  const start = new Date(startDate).getTime()
  const end = endDate ? new Date(endDate).getTime() : start + 105 * 24 * 60 * 60 * 1000
  return Date.now() >= start && Date.now() <= end
}

type CourseOption = { id: string; name: string; start_date: string | null; end_date: string | null }

/** Prefer the currently-active enrollment; otherwise the most recently started one. */
function pickDefaultCourse(courses: CourseOption[]): CourseOption | undefined {
  const current = courses.find(c => isCurrent(c.start_date, c.end_date))
  if (current) return current
  return [...courses].sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))[0]
}

export default async function StudentReadinessPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('course_id')
    .eq('user_id', user.id)
    .eq('role', 'student')

  const courseIds = enrollments?.map(e => e.course_id) ?? []
  const { data: courses } = courseIds.length
    ? await supabase
        .from('courses')
        .select('id, name, start_date, end_date')
        .in('id', courseIds)
    : { data: [] }

  const { course: courseParam } = await searchParams
  const options = courses ?? []
  const selectedCourse = (courseParam ? options.find(c => c.id === courseParam) : undefined) ?? pickDefaultCourse(options)

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />

      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-8 sm:px-6 sm:py-10 focus:outline-none">
        {options.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap mb-4 max-w-4xl mx-auto">
            {options.map(c => (
              <Link
                key={c.id}
                href={`/student/readiness?course=${c.id}`}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                  selectedCourse?.id === c.id
                    ? 'bg-teal-light border-teal-primary text-teal-primary'
                    : 'border-border text-muted-text hover:text-dark-text'
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}

        {selectedCourse ? (
          <ReadinessTracker courseId={selectedCourse.id} userName={profile?.name ?? 'Student'} />
        ) : (
          <p className="text-muted-text">You&apos;re not enrolled in a course yet.</p>
        )}
      </main>
    </div>
  )
}
