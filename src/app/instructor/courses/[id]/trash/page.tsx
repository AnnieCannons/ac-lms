import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import { getInstructorOrTaAccess } from '@/lib/instructor-access'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getTrashedItems, emptyTrash } from '@/lib/trash-actions'
import TrashView from './TrashView'

export default async function TrashPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ action?: string }>
}) {
  const { id } = await params
  const { action } = await searchParams
  const { profile, isTa } = await getInstructorOrTaAccess(id)
  if (isTa) redirect(`/instructor/courses/${id}`)

  let admin: ReturnType<typeof createServiceSupabaseClient>
  try { admin = createServiceSupabaseClient() } catch { redirect('/instructor/courses') }

  const { data: course } = await admin.from('courses').select('id, name').eq('id', id).single()
  if (!course) redirect('/instructor/courses')

  // Handle ?action=empty from the weekly popup
  if (action === 'empty') {
    await emptyTrash(id)
    redirect(`/instructor/courses/${id}/trash`)
  }

  const { items = [], error } = await getTrashedItems(id)

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} isTa={isTa} breadcrumbs={[{ label: 'Courses', href: '/instructor/courses' }, { label: course.name, href: `/instructor/courses/${id}` }, { label: 'Trash' }]} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <main className="flex-1 min-w-0 px-8 py-10 max-w-4xl">
          <div className="flex items-center gap-2 text-sm text-muted-text mb-6 flex-wrap">
            <Link href="/instructor/courses" className="hover:text-teal-primary">Courses</Link>
            <span className="text-border">/</span>
            <Link href={`/instructor/courses/${id}`} className="hover:text-teal-primary">{course.name}</Link>
            <span className="text-border">/</span>
            <span className="text-dark-text font-medium">Trash</span>
          </div>

          <div className="flex items-center gap-3 mb-8">
            <h1 className="text-2xl font-bold text-dark-text">Trash</h1>
            {items.length > 0 && (
              <span className="text-sm text-muted-text">{items.length} item{items.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {error ? (
            <div className="bg-surface rounded-2xl border border-red-500/30 p-6 text-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          ) : (
            <TrashView courseId={id} initialItems={items} />
          )}
        </main>
      </div>
    </div>
  )
}
