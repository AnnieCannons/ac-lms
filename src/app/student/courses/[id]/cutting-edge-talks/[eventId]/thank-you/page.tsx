import Link from 'next/link'
import { getStudentCuttingEdgeEvent } from '@/lib/cutting-edge-student'
import { formatDueDate, hasStarted, isThanksRequired, THANKS_TITLE } from '@/lib/cutting-edge'
import StudentCuttingEdgeShell from '@/components/cutting-edge/StudentCuttingEdgeShell'
import StudentCheckoff from '@/components/cutting-edge/StudentCheckoff'
import PadletButton from '@/components/cutting-edge/PadletButton'
import HtmlContent from '@/components/ui/HtmlContent'

export default async function StudentCuttingEdgeThanksPage({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await params
  const { viewer, course, event, rsvp, now, canAct } = await getStudentCuttingEdgeEvent(id, eventId)
  const open = hasStarted(event, now)
  const state = rsvp?.thanks_done_at ? 'done' : rsvp?.missed_at ? 'missed' : null

  return (
    <StudentCuttingEdgeShell viewer={viewer} course={course}>
      <Link href={`/student/courses/${id}/cutting-edge-talks/${eventId}`} className="text-sm text-muted-text hover:text-teal-primary">← {event.title}</Link>
      <h1 className="text-2xl font-bold text-dark-text mt-3">{THANKS_TITLE}</h1>
      <p className="text-sm text-muted-text mt-1">
        Due {formatDueDate(event.thanks_due_date)} · {isThanksRequired(event, rsvp, now) ? 'Required because you RSVP’d yes' : 'Required after the talk if you RSVP’d yes'}
      </p>
      {event.thanks_html && <div className="mt-6"><HtmlContent html={event.thanks_html} /></div>}
      {open && <div className="mt-6"><PadletButton url={event.thanks_padlet_url} label="Add your thank-you on the Padlet" /></div>}
      <div className="mt-6">
        <StudentCheckoff kind="thanks" courseId={id} eventId={eventId} state={state} canAct={canAct} open={open} />
      </div>
    </StudentCuttingEdgeShell>
  )
}
