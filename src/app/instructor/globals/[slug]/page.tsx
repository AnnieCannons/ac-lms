import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import GlobalContentEditor from '@/components/ui/GlobalContentEditor'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import InstructorGlobalNav from '@/components/ui/InstructorGlobalNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'

export default async function GlobalSlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') redirect('/unauthorized')

  const { data: globalRow } = await supabase
    .from('global_content')
    .select('title')
    .eq('slug', slug)
    .single()

  if (!globalRow) redirect('/instructor/courses')

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
          <main className="max-w-3xl mx-auto px-8 py-10">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text">{globalRow.title}</h1>
              <p className="text-sm text-muted-text mt-1">
                Global template displayed on every course&apos;s General Info page.
              </p>
            </div>
            <GlobalContentEditor slug={slug} title={globalRow.title} />
          </main>
        </div>
      </div>
    </div>
  )
}
