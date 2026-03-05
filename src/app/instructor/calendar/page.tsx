import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CalendarEditor from '@/components/ui/CalendarEditor'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import InstructorGlobalNav from '@/components/ui/InstructorGlobalNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'

export default async function InstructorCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') redirect('/unauthorized')

  const { from } = await searchParams
  const { data: course } = from
    ? await supabase.from('courses').select('id, name').eq('id', from).single()
    : { data: null }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <Link href="/instructor/courses" className="text-xl font-extrabold text-dark-text">
          AC<span className="text-teal-primary">*</span>
        </Link>
        <Link href="/instructor/courses" className="text-sm text-muted-text hover:text-teal-primary transition-colors">
          ← All Courses
        </Link>
      </nav>

      <div className="flex">
        {course
          ? <InstructorSidebar courseId={course.id} courseName={course.name} />
          : <ResizableSidebar><InstructorGlobalNav /></ResizableSidebar>
        }
        <div className="flex-1 min-w-0">
          <main className="max-w-3xl mx-auto px-8 py-10">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text">Main Calendar</h1>
              <p className="text-sm text-muted-text mt-1">
                Cohort and break dates displayed on every course&apos;s General Info page.
              </p>
            </div>
            <CalendarEditor />
          </main>
        </div>
      </div>
    </div>
  )
}
