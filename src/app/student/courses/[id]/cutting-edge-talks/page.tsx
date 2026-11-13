import Link from 'next/link'
import { getStudentCuttingEdge } from '@/lib/cutting-edge-student'
import { formatDueDate, hasStarted, isThanksRequired, type CuttingEdgeEvent, type CuttingEdgeRsvp } from '@/lib/cutting-edge'
import LocalEventTime from '@/components/cutting-edge/LocalEventTime'
import StudentCuttingEdgeShell from '@/components/cutting-edge/StudentCuttingEdgeShell'

function todo(event: CuttingEdgeEvent, rsvp: CuttingEdgeRsvp | null, now: Date): { label: string; tone: 'amber' | 'muted' | 'teal' } | null {
  if (!hasStarted(event, now)) {
    if (!rsvp?.response) return { label: 'RSVP needed', tone: 'amber' }
    if (rsvp.response === 'yes' && !rsvp.question_done_at) return { label: `Question due ${formatDueDate(event.question_due_date)}`, tone: 'amber' }
    return { label: rsvp.response === 'yes' ? 'Going' : 'Not going', tone: rsvp.response === 'yes' ? 'teal' : 'muted' }
  }
  if (isThanksRequired(event, rsvp, now) && !rsvp?.thanks_done_at && !rsvp?.missed_at) {
    return { label: `Thank-you due ${formatDueDate(event.thanks_due_date)}`, tone: 'amber' }
  }
  return null
}

export default async function StudentCuttingEdgeTalksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { viewer, course, items, now } = await getStudentCuttingEdge(id)
  const upcoming = items.filter(i => !hasStarted(i.event, now))
  const past = items.filter(i => hasStarted(i.event, now)).reverse()

  const list = (label: string, list: typeof items) => (
    <section className="mb-10">
      <h2 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-3">{label}</h2>
      {list.length === 0 ? <p className="text-sm text-muted-text">None right now.</p> : (
        <div className="flex flex-col gap-2">
          {list.map(({ event, rsvp }) => {
            const t = todo(event, rsvp, now)
            return (
              <Link key={event.id} href={`/student/courses/${id}/cutting-edge-talks/${event.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-border bg-surface hover:border-teal-primary/40 hover:bg-teal-light/40 transition-colors">
                <div className="min-w-0">
                  <p className="font-semibold text-dark-text">🎤 {event.title}</p>
                  <p className="text-xs text-muted-text mt-0.5"><LocalEventTime iso={event.starts_at} />{event.block ? ` · Block ${event.block}` : ''}{event.speaker ? ` · ${event.speaker}` : ''}</p>
                </div>
                {t && (
                  <span className={`shrink-0 text-[11px] font-semibold border rounded-full px-2 py-0.5 ${
                    t.tone === 'amber' ? 'badge-amber' : t.tone === 'teal' ? 'badge-current' : 'border-border text-muted-text'
                  }`}>{t.label}</span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )

  return (
    <StudentCuttingEdgeShell viewer={viewer} course={course}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-dark-text">Cutting Edge Talks</h1>
        <p className="text-sm text-muted-text mt-1">Guest speakers from across tech. RSVP, send your question in advance, and say thank you afterward.</p>
      </div>
      {list('Upcoming', upcoming)}
      {list('Past', past)}
    </StudentCuttingEdgeShell>
  )
}
