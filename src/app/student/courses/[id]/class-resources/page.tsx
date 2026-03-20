import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import ResourceOutline from '@/components/ui/ResourceOutline'
import { isStudentPreview } from '@/lib/student-preview'
import StudentViewBanner from '@/components/ui/StudentViewBanner'

export default async function StudentClassResourcesPage({
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
    .in('role', ['student', 'ta'])
    .maybeSingle()

  if (!preview && !enrollment) redirect('/student/courses')

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code, paid_learners')
    .eq('id', id)
    .single()

  if (!course) redirect('/student/courses')

  const [{ data: rawModules }, { data: stars }, { data: completions }] = await Promise.all([
    supabase
      .from('modules')
      .select('id, title, week_number, order, module_days(id, day_name, order, resources!module_day_id(id, type, title, content, description, order))')
      .eq('course_id', id)
      .eq('published', true)
      .order('order', { ascending: true }),
    supabase.from('resource_stars').select('resource_id').eq('user_id', user.id),
    supabase.from('resource_completions').select('resource_id').eq('user_id', user.id),
  ])

  const modules = (rawModules ?? []).filter(m => !m.title?.includes('DO NOT PUBLISH'))
  const starredIds = (stars ?? []).map(s => s.resource_id)
  const completedIds = (completions ?? []).map(c => c.resource_id)

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
              <h1 className="text-2xl font-bold text-dark-text mb-1">Class Resources</h1>
              <p className="text-muted-text text-sm">{course.code}</p>
            </div>

            <ResourceOutline
              modules={modules as Parameters<typeof ResourceOutline>[0]['modules']}
              courseId={id}
              mode="resources"
              initialStarredIds={starredIds}
              initialCompletedIds={completedIds}
            />
          </main>
        </div>
      </div>
    </div>
  )
}
