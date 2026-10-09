import Link from 'next/link'
import { getStudentCuttingEdgeEvent } from '@/lib/cutting-edge-student'
import { canChangeRsvp, formatDueDate, hasStarted, isThanksRequired, QUESTION_TITLE, THANKS_TITLE } from '@/lib/cutting-edge'
import LocalEventTime from '@/components/cutting-edge/LocalEventTime'
import StudentCuttingEdgeShell from '@/components/cutting-edge/StudentCuttingEdgeShell'
import StudentRsvp from '@/components/cutting-edge/StudentRsvp'
import HtmlContent from '@/components/ui/HtmlContent'

export default async function StudentCuttingEdgeEventPage({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await params
  const { viewer, course, event, rsvp, now, canAct } = await getStudentCuttingEdgeEvent(id, eventId)
  const base = `/student/courses/${id}/cutting-edge-talks/${eventId}`
  const started = hasStarted(event, now)

  const assignmentCard = (href: string, title: string, due: string, status: string, required: boolean) => (
    <Link href={href} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-border bg-surface hover:border-teal-primary/40 hover:bg-teal-light/40 transition-colors">
      <div>
        <p className="font-semibold text-dark-text">{title}</p>
        <p className="text-xs text-muted-text mt-0.5">Due {formatDueDate(due)}{required ? '' : ' · only if you RSVP yes'}</p>
      </div>
      <span className="shrink-0 text-xs font-semibold text-muted-text">{status}</span>
    </Link>
  )

  const questionStatus = rsvp?.question_done_at ? '✓ Done' : rsvp?.response === 'yes' ? 'To do' : ''
  const thanksStatus = rsvp?.thanks_done_at ? '✓ Done' : rsvp?.missed_at ? 'Didn’t make it' : isThanksRequired(event, rsvp, now) ? 'To do' : started ? '' : 'After the talk'

  return (
    <StudentCuttingEdgeShell viewer={viewer} course={course}>
      <Link href={`/student/courses/${id}/cutting-edge-talks`} className="text-sm text-muted-text hover:text-teal-primary">← Cutting Edge Talks</Link>
      <h1 className="text-2xl font-bold text-dark-text mt-3">🎤 {event.title}</h1>
      {event.speaker && <p className="text-dark-text mt-1">{event.speaker}</p>}
      <p className="text-sm text-muted-text mt-2"><LocalEventTime iso={event.starts_at} />{event.block ? ` · Block ${event.block}` : ''}</p>
      {(event.location_text || event.location_url) && (
        <p className="text-sm text-muted-text mt-1">
          {event.location_text}
          {event.location_url && <> · <a href={event.location_url} target="_blank" rel="noopener noreferrer" className="text-teal-primary underline">Join link</a></>}
        </p>
      )}

      <div className="bg-surface rounded-2xl border border-border p-6 mt-6">
        <StudentRsvp courseId={id} eventId={eventId} response={rsvp?.response ?? null} locked={!canChangeRsvp(event, now)} canAct={canAct} />
      </div>

      {event.about_html && (
        <div className="mt-6">
          <h2 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-2">About</h2>
          <HtmlContent html={event.about_html} />
        </div>
      )}

      <div className="mt-8 flex flex-col gap-2">
        <h2 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-1">Assignments</h2>
        {assignmentCard(`${base}/question`, QUESTION_TITLE, event.question_due_date, questionStatus, rsvp?.response === 'yes')}
        {assignmentCard(`${base}/thank-you`, THANKS_TITLE, event.thanks_due_date, thanksStatus, rsvp?.response === 'yes')}
      </div>
    </StudentCuttingEdgeShell>
  )
}
