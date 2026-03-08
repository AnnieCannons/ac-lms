import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'
import StudentWorkList, { type WorkAssignment } from '@/components/ui/StudentWorkList'
import { isStudentPreview } from '@/lib/student-preview'
import StudentViewBanner from '@/components/ui/StudentViewBanner'

function getCurrentWeek(startDate: string | null): number | null {
  if (!startDate) return null
  const start = new Date(startDate)
  const today = new Date()
  const diffMs = today.getTime() - start.getTime()
  if (diffMs < 0) return null
  return Math.floor(Math.floor(diffMs / (1000 * 60 * 60 * 24)) / 7) + 1
}

export default async function MyWorkPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const preview = await isStudentPreview(id)

  if (!preview && (profile?.role === 'instructor' || profile?.role === 'admin')) {
    redirect(`/instructor/courses/${id}`)
  }

  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', id)
    .eq('role', 'student')
    .maybeSingle()

  if (!preview && !enrollment) redirect('/student/courses')

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code, start_date')
    .eq('id', id)
    .single()

  if (!course) redirect('/student/courses')

  const { data: modules } = await supabase
    .from('modules')
    .select('id, title, week_number, order, module_days(id, assignments!module_day_id(id, title, due_date, is_bonus))')
    .eq('course_id', id)
    .order('order', { ascending: true })

  const { data: submissions } = await supabase
    .from('submissions')
    .select('assignment_id, status, grade')
    .eq('student_id', user.id)

  const submissionMap = new Map(
    (submissions ?? []).map(s => [s.assignment_id, { status: s.status, grade: s.grade ?? null }])
  )

  const now = new Date()
  const currentWeek = getCurrentWeek(course.start_date)

  const assignments: WorkAssignment[] = (modules ?? []).flatMap(module =>
    (module.module_days ?? []).flatMap(
      (day: { id: string; assignments?: { id: string; title: string; due_date: string | null; is_bonus?: boolean }[] }) =>
        (day.assignments ?? [])
          .filter(a => {
            // Bonus assignments: only show if the student has completed them
            if (!a.is_bonus) return true
            const sub = submissionMap.get(a.id)
            return sub?.grade === 'complete'
          })
          .map(a => {
          const sub = submissionMap.get(a.id) ?? null
          const isLate = !sub && !!a.due_date && new Date(a.due_date) < now
          return {
            id: a.id,
            title: a.title,
            due_date: a.due_date,
            status: (sub?.status ?? null) as WorkAssignment['status'],
            grade: (sub?.grade ?? null) as WorkAssignment['grade'],
            isLate,
            moduleTitle: module.title,
            weekNumber: module.week_number,
            isCurrentWeek: currentWeek !== null && module.week_number === currentWeek,
            courseId: id,
          }
        })
    )
  )

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />
      {preview && <StudentViewBanner courseId={id} />}

      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-8 py-12 focus:outline-none">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/student/courses" className="text-muted-text hover:text-teal-primary text-sm">← My Courses</Link>
            <span className="text-border">/</span>
            <Link href={`/student/courses/${id}`} className="text-muted-text hover:text-teal-primary text-sm">{course.name}</Link>
            <span className="text-border">/</span>
            <h2 className="text-2xl font-bold text-dark-text">My Work</h2>
          </div>
          <Link href={`/student/courses/${id}`} className="text-sm text-teal-primary font-medium hover:underline shrink-0">
            Course Overview →
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <p className="text-muted-text text-sm">{course.name}</p>
          {currentWeek && (
            <span className="bg-teal-light text-teal-primary text-xs font-semibold px-3 py-1 rounded-full">
              Week {currentWeek} this week
            </span>
          )}
        </div>

        {assignments.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-12 text-center">
            <p className="text-muted-text">No assignments available yet.</p>
          </div>
        ) : (
          <StudentWorkList assignments={assignments} currentWeek={currentWeek} />
        )}
      </main>
    </div>
  )
}
