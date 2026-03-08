import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import ResourceOutline from '@/components/ui/ResourceOutline'
import PageRefresher from '@/components/ui/PageRefresher'
import { isStudentPreview } from '@/lib/student-preview'
import StudentViewBanner from '@/components/ui/StudentViewBanner'

export const dynamic = 'force-dynamic'

export default async function StudentAssignmentsPage({
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
    .select('id, role')
    .eq('user_id', user.id)
    .eq('course_id', id)
    .in('role', ['student', 'observer'])
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
    .select('id, title, week_number, order, module_days(id, day_name, order, assignments!module_day_id(id, title, due_date, published, is_bonus))')
    .eq('course_id', id)
    .eq('published', true)
    .order('order', { ascending: true })

  // Filter bonus assignments out of the assignments list (they belong to Level Up only)
  const modules = (rawModules ?? []).filter(m => !m.title?.includes('DO NOT PUBLISH')).map(m => ({
    ...m,
    module_days: (m.module_days ?? []).map((d: { id: string; day_name: string; order: number; assignments?: Array<{ id: string; title: string; due_date: string | null; published: boolean; is_bonus?: boolean }> }) => ({
      ...d,
      assignments: (d.assignments ?? []).filter((a) => !a.is_bonus),
    })),
  }))

  const { data: submissions } = await supabase
    .from('submissions')
    .select('assignment_id, status, grade')
    .eq('student_id', user.id)

  const submissionMap = Object.fromEntries(
    (submissions ?? []).map(s => [s.assignment_id, { status: s.status, grade: s.grade ?? null }])
  )

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
              <h1 className="text-2xl font-bold text-dark-text mb-1">Assignments</h1>
              <p className="text-muted-text text-sm">{course.code}</p>
            </div>

            <PageRefresher />
            <ResourceOutline
              modules={modules as Parameters<typeof ResourceOutline>[0]['modules']}
              courseId={id}
              mode="assignments"
              submissionMap={submissionMap}
            />
          </main>
        </div>
      </div>
    </div>
  )
}
