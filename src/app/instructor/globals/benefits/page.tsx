import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import GlobalContentEditor from '@/components/ui/GlobalContentEditor'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import InstructorGlobalNav from '@/components/ui/InstructorGlobalNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'

export default async function BenefitsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') redirect('/unauthorized')

  const { from } = await searchParams
  const { data: course } = from
    ? await supabase.from('courses').select('id, name').eq('id', from).single()
    : { data: null }

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />

      <div className="flex">
        {course
          ? <InstructorSidebar courseId={course.id} courseName={course.name} />
          : <ResizableSidebar><InstructorGlobalNav /></ResizableSidebar>
        }
        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-8 py-10 focus:outline-none">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text">Benefits</h1>
              <p className="text-sm text-muted-text mt-1">
                Global benefit information shown to students in paid courses.
              </p>
            </div>
            <div className="flex flex-col gap-6">
              <GlobalContentEditor slug="benefits-healthcare" title="Healthcare" />
              <GlobalContentEditor slug="benefits-vision" title="Vision" />
              <GlobalContentEditor slug="benefits-dental" title="Dental" />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
