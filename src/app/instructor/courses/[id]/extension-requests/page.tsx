import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import { getInstructorOrTaAccess } from '@/lib/instructor-access'
import { getCourseExtensionRequests } from '@/lib/extension-actions'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import ExtensionRequestList from '@/components/instructor/ExtensionRequestList'

export default async function ExtensionRequestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { profile } = await getInstructorOrTaAccess(id)

  let admin: ReturnType<typeof createServiceSupabaseClient>
  try { admin = createServiceSupabaseClient() } catch { redirect('/instructor/courses') }

  const { data: course } = await admin.from('courses').select('id, name, paid_learners').eq('id', id).single()
  if (!course) redirect('/instructor/courses')

  const requests = await getCourseExtensionRequests(id)

  const pending = requests.filter(r => r.status === 'pending')
  const reviewed = requests.filter(r => r.status !== 'pending')

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <div className="flex">
        <InstructorSidebar courseId={id} />
        <main className="flex-1 min-w-0 max-w-3xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-text mb-6">
            <Link href="/instructor/courses" className="hover:text-teal-primary">Courses</Link>
            <span className="text-border">/</span>
            <Link href={`/instructor/courses/${id}`} className="hover:text-teal-primary">{course.name}</Link>
            <span className="text-border">/</span>
            <span className="text-dark-text font-medium">Extension Requests</span>
          </div>

          <div className="flex items-center justify-between mb-8">
            <h1 className="text-xl sm:text-2xl font-bold text-dark-text">Extension Requests</h1>
            {pending.length > 0 && (
              <span className="text-sm font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/40 rounded-full px-3 py-1">
                {pending.length} pending
              </span>
            )}
          </div>

          <ExtensionRequestList
            courseId={id}
            pending={pending}
            reviewed={reviewed}
          />
        </main>
      </div>
    </div>
  )
}
