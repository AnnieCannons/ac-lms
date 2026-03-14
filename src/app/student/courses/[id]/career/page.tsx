import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import CourseOutlineAccordion from '@/components/ui/CourseOutlineAccordion'
import { isStudentPreview } from '@/lib/student-preview'
import StudentViewBanner from '@/components/ui/StudentViewBanner'

export default async function StudentCareerPage({
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
    .select('*')
    .eq('id', id)
    .single()

  if (!course) redirect('/student/courses')

  const { data: rawModules } = await supabase
    .from('modules')
    .select('*, module_days(id, day_name, order, deleted_at, assignments!module_day_id(id, title, due_date, published, deleted_at), resources!module_day_id(id, type, title, content, description, order, deleted_at))')
    .eq('course_id', id)
    .eq('category', 'career')
    .eq('published', true)
    .is('deleted_at', null)
    .order('order', { ascending: true })

  const modules = (rawModules ?? [])
    .filter(m => !m.title?.includes('DO NOT PUBLISH'))
    .map(m => ({
      ...m,
      module_days: (m.module_days ?? [])
        .filter((d: { deleted_at: string | null }) => !d.deleted_at)
        .map((d: { assignments?: Array<{ deleted_at: string | null }>; resources?: Array<{ deleted_at: string | null }> }) => ({
          ...d,
          assignments: (d.assignments ?? []).filter(a => !a.deleted_at),
          resources: (d.resources ?? []).filter(r => !r.deleted_at),
        })),
    }))

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />
      {preview && <StudentViewBanner courseId={id} />}

      <div className="flex">
        <ResizableSidebar>
          <StudentCourseNav courseId={id} courseName={course.name} paidLearners={course.paid_learners ?? false} />
        </ResizableSidebar>

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-8 py-10 focus:outline-none">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/student/courses" className="text-muted-text hover:text-teal-primary text-sm">
                ← My Courses
              </Link>
            </div>

            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text mb-1">Career Development</h1>
              <p className="text-muted-text text-sm">{course.code}</p>
            </div>

            {modules.length > 0 ? (
              <CourseOutlineAccordion
                modules={modules as Parameters<typeof CourseOutlineAccordion>[0]['modules']}
                courseId={id}
                currentWeek={null}
                todayName=""
              />
            ) : (
              <div className="bg-surface rounded-2xl border border-border p-12 text-center">
                <p className="text-muted-text">No content available yet.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
