import { redirect } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getCuttingEdgeStaffViewer } from '@/lib/cutting-edge-access'
import { loadPickableCourses } from '@/lib/cutting-edge-form-data'
import { QUESTION_TEMPLATE_HTML, THANKS_TEMPLATE_HTML, withFrom } from '@/lib/cutting-edge'
import CuttingEdgeStaffShell from '@/components/cutting-edge/CuttingEdgeStaffShell'
import CuttingEdgeEventForm from '@/components/cutting-edge/CuttingEdgeEventFormLoader'

export default async function NewCuttingEdgeEventPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>
}) {
  const viewer = await getCuttingEdgeStaffViewer()
  const { from } = await searchParams
  if (!viewer.canEdit) redirect(withFrom('/instructor/cutting-edge-talks', from))

  const courses = await loadPickableCourses(createServiceSupabaseClient())

  return (
    <CuttingEdgeStaffShell
      viewer={viewer}
      from={from}
      breadcrumbs={[{ label: 'Cutting Edge Talks', href: withFrom('/instructor/cutting-edge-talks', from) }, { label: 'New event' }]}
    >
      <h1 className="text-2xl font-bold text-dark-text mb-1">New Cutting Edge Talk</h1>
      <p className="text-sm text-muted-text mb-8">Saved as a draft — students won&apos;t see it (or get notified) until you publish.</p>
      <CuttingEdgeEventForm
        eventId={null}
        from={from}
        courses={courses}
        initial={{
          title: '', speaker: '', date: '', time: '', startsAt: '', block: '', locationText: 'Focus Friday Zoom', locationUrl: '', aboutHtml: '',
          audienceAll: true, courseIds: [],
          questionDueDate: '', questionHtml: QUESTION_TEMPLATE_HTML, questionPadletUrl: '',
          thanksDueDate: '', thanksHtml: THANKS_TEMPLATE_HTML, thanksPadletUrl: '',
        }}
      />
    </CuttingEdgeStaffShell>
  )
}
