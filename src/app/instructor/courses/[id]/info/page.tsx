import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorCourseNav from '@/components/ui/InstructorCourseNav'
import SyllabusEditor from '@/components/ui/SyllabusEditor'

export default async function InstructorGeneralInfoPage({
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
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
    redirect('/unauthorized')
  }

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code, syllabus_content')
    .eq('id', id)
    .single()

  if (!course) redirect('/instructor/courses')

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <Link href="/instructor/courses" className="text-xl font-extrabold text-dark-text">
          AC<span className="text-teal-primary">*</span>
        </Link>
      </nav>

      <div className="flex">
        {/* Left sidebar */}
        <aside className="w-56 shrink-0 border-r border-border min-h-[calc(100vh-65px)] py-8 px-3">
          <InstructorCourseNav courseId={id} courseName={course.name} />
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <main className="max-w-3xl mx-auto px-8 py-10">
            <div className="flex items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-bold text-dark-text">General Info</h1>
                <p className="text-sm text-muted-text mt-1">{course.name}</p>
              </div>
              <Link
                href="/instructor/courses"
                className="text-sm text-muted-text hover:text-teal-primary"
              >
                ← Courses
              </Link>
            </div>

            <SyllabusEditor courseId={id} initialContent={course.syllabus_content} />
          </main>
        </div>
      </div>
    </div>
  )
}
