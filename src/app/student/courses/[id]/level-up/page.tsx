import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import CourseOutlineAccordion from '@/components/ui/CourseOutlineAccordion'

export default async function StudentLevelUpPage({
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

  if (profile?.role === 'instructor' || profile?.role === 'admin') {
    redirect(`/instructor/courses/${id}`)
  }

  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', id)
    .eq('role', 'student')
    .maybeSingle()

  if (!enrollment) redirect('/student/courses')

  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single()

  if (!course) redirect('/student/courses')

  const { data: rawModules } = await supabase
    .from('modules')
    .select('*, module_days(id, day_name, order, assignments(id, title, due_date, published), resources(id, type, title, content, description, order))')
    .eq('course_id', id)
    .eq('category', 'level_up')
    .eq('published', true)
    .order('order', { ascending: true })

  const modules = (rawModules ?? []).filter(m => !m.title?.includes('DO NOT PUBLISH'))

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />

      <div className="flex">
        <ResizableSidebar>
          <StudentCourseNav courseId={id} courseName={course.name} />
        </ResizableSidebar>

        <div className="flex-1 min-w-0">
          <main className="max-w-3xl mx-auto px-8 py-10">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/student/courses" className="text-muted-text hover:text-teal-primary text-sm">
                ← My Courses
              </Link>
            </div>

            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text mb-1">Level Up Your Skills</h1>
              <p className="text-muted-text text-sm">{course.code}</p>
            </div>

            {modules.length > 0 ? (
              <CourseOutlineAccordion
                modules={modules as Parameters<typeof CourseOutlineAccordion>[0]['modules']}
                courseId={id}
                currentWeek={null}
                todayName=""
                hideLevelUpBanner
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
