import { notFound, redirect } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getCuttingEdgeStaffViewer } from '@/lib/cutting-edge-access'
import { loadPickableCourses } from '@/lib/cutting-edge-form-data'
import { EVENT_COLUMNS, loadLimitedCourseIds } from '@/lib/cutting-edge-server'
import { withFrom, type CuttingEdgeEvent } from '@/lib/cutting-edge'
import CuttingEdgeStaffShell from '@/components/cutting-edge/CuttingEdgeStaffShell'
import CuttingEdgeEventForm from '@/components/cutting-edge/CuttingEdgeEventFormLoader'

export default async function EditCuttingEdgeEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const viewer = await getCuttingEdgeStaffViewer()
  const { eventId } = await params
  const { from } = await searchParams
  if (!viewer.canEdit) redirect(withFrom(`/instructor/cutting-edge-talks/${eventId}`, from))

  const admin = createServiceSupabaseClient()
  const { data } = await admin.from('cutting_edge_events').select(EVENT_COLUMNS).eq('id', eventId).maybeSingle()
  if (!data || data.deleted_at) notFound()
  const event = data as CuttingEdgeEvent
  const courseIds = event.audience_all ? [] : await loadLimitedCourseIds(admin, eventId)
  const courses = await loadPickableCourses(admin, courseIds)

  return (
    <CuttingEdgeStaffShell
      viewer={viewer}
      from={from}
      breadcrumbs={[
        { label: 'Cutting Edge Talks', href: withFrom('/instructor/cutting-edge-talks', from) },
        { label: event.title, href: withFrom(`/instructor/cutting-edge-talks/${eventId}`, from) },
        { label: 'Edit' },
      ]}
    >
      <h1 className="text-2xl font-bold text-dark-text mb-8">Edit {event.title}</h1>
      <CuttingEdgeEventForm
        eventId={eventId}
        from={from}
        courses={courses}
        initial={{
          title: event.title,
          speaker: event.speaker ?? '',
          date: '',
          time: '',
          startsAt: event.starts_at,
          block: event.block ?? '',
          locationText: event.location_text ?? '',
          locationUrl: event.location_url ?? '',
          aboutHtml: event.about_html ?? '',
          audienceAll: event.audience_all,
          courseIds,
          questionDueDate: event.question_due_date,
          questionHtml: event.question_html ?? '',
          questionPadletUrl: event.question_padlet_url ?? '',
          thanksDueDate: event.thanks_due_date,
          thanksHtml: event.thanks_html ?? '',
          thanksPadletUrl: event.thanks_padlet_url ?? '',
        }}
      />
    </CuttingEdgeStaffShell>
  )
}
