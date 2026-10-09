import Link from 'next/link'
import { getStudentCuttingEdgeEvent } from '@/lib/cutting-edge-student'
import { formatDueDate, isQuestionRequired, QUESTION_TITLE } from '@/lib/cutting-edge'
import StudentCuttingEdgeShell from '@/components/cutting-edge/StudentCuttingEdgeShell'
import StudentCheckoff from '@/components/cutting-edge/StudentCheckoff'
import PadletButton from '@/components/cutting-edge/PadletButton'
import HtmlContent from '@/components/ui/HtmlContent'

export default async function StudentCuttingEdgeQuestionPage({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await params
  const { viewer, course, event, rsvp, canAct } = await getStudentCuttingEdgeEvent(id, eventId)

  return (
    <StudentCuttingEdgeShell viewer={viewer} course={course}>
      <Link href={`/student/courses/${id}/cutting-edge-talks/${eventId}`} className="text-sm text-muted-text hover:text-teal-primary">← {event.title}</Link>
      <h1 className="text-2xl font-bold text-dark-text mt-3">{QUESTION_TITLE}</h1>
      <p className="text-sm text-muted-text mt-1">
        Due {formatDueDate(event.question_due_date)} · {isQuestionRequired(rsvp) ? 'Required because you RSVP’d yes' : 'Required if you RSVP yes'}
      </p>
      {event.question_html && <div className="mt-6"><HtmlContent html={event.question_html} /></div>}
      <div className="mt-6"><PadletButton url={event.question_padlet_url} label="Submit your question on the Padlet" /></div>
      <div className="mt-6">
        <StudentCheckoff kind="question" courseId={id} eventId={eventId} done={!!rsvp?.question_done_at} canAct={canAct} />
      </div>
    </StudentCuttingEdgeShell>
  )
}
