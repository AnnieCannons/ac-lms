import Link from 'next/link'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getCuttingEdgeStaffViewer } from '@/lib/cutting-edge-access'
import { loadAllEvents, loadCourses, loadEventReport } from '@/lib/cutting-edge-server'
import { hasStarted, summarize, withFrom } from '@/lib/cutting-edge'
import CuttingEdgeStaffShell from '@/components/cutting-edge/CuttingEdgeStaffShell'
import LocalEventTime from '@/components/cutting-edge/LocalEventTime'
import ClassFilter from '@/components/cutting-edge/ClassFilter'

export default async function CuttingEdgeTalksPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; course?: string }>
}) {
  const viewer = await getCuttingEdgeStaffViewer()
  const { from, course } = await searchParams
  const admin = createServiceSupabaseClient()
  const now = new Date()

  const [events, courses] = await Promise.all([loadAllEvents(admin), loadCourses(admin)])
  const reports = await Promise.all(events.map(e => loadEventReport(admin, e, now, courses)))

  const courseIdsSeen = new Set(reports.flatMap(r => r.rows.map(row => row.courseId).filter((id): id is string => !!id)))
  const courseOptions = courses.filter(c => courseIdsSeen.has(c.id)).sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))

  const rowsFor = (i: number) => course ? reports[i].rows.filter(r => r.courseId === course) : reports[i].rows
  const upcoming = events.map((e, i) => ({ e, i })).filter(({ e }) => !hasStarted(e, now)).reverse()
  const past = events.map((e, i) => ({ e, i })).filter(({ e }) => hasStarted(e, now))

  const section = (label: string, list: typeof upcoming) => (
    <section className="mb-10">
      <h2 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-3">{label}</h2>
      {list.length === 0 ? (
        <p className="text-sm text-muted-text">None.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-muted-text text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Talk</th>
                <th className="px-2 py-2 font-semibold" title="RSVP'd yes">Yes</th>
                <th className="px-2 py-2 font-semibold" title="RSVP'd no">No</th>
                <th className="px-2 py-2 font-semibold" title="No RSVP yet">No reply</th>
                <th className="px-2 py-2 font-semibold" title="Submitted their question">Question</th>
                <th className="px-2 py-2 font-semibold" title="Said thank you">Thanked</th>
                <th className="px-2 py-2 font-semibold" title="Said yes, checked 'I did not make it'">Missed</th>
                <th className="px-2 py-2 font-semibold" title="Said yes, no thank-you or 'did not make it' after the due date">No follow-up</th>
              </tr>
            </thead>
            <tbody>
              {list.map(({ e, i }) => {
                const s = summarize(rowsFor(i))
                const missingPadlet = !e.question_padlet_url || !e.thanks_padlet_url
                return (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link href={withFrom(`/instructor/cutting-edge-talks/${e.id}`, from, { course })} className="font-semibold text-dark-text hover:text-teal-primary">
                        {e.title}
                      </Link>
                      <div className="text-xs text-muted-text mt-0.5"><LocalEventTime iso={e.starts_at} />{e.block ? ` · Block ${e.block}` : ''}{e.speaker ? ` · ${e.speaker}` : ''}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {e.status === 'draft' && <span className="text-[11px] font-semibold border border-border rounded-full px-2 py-0.5 text-muted-text">Draft</span>}
                        {missingPadlet && <span className="badge-amber text-[11px] font-semibold border rounded-full px-2 py-0.5">Padlet link missing</span>}
                        {!e.audience_all && <span className="text-[11px] font-semibold border border-border rounded-full px-2 py-0.5 text-muted-text">Limited classes</span>}
                      </div>
                    </td>
                    <td className="text-center px-2">{s.yes}</td>
                    <td className="text-center px-2">{s.no}</td>
                    <td className="text-center px-2 text-muted-text">{s.noResponse}</td>
                    <td className="text-center px-2">{s.questionDone}</td>
                    <td className="text-center px-2">{s.thanked}</td>
                    <td className="text-center px-2">{s.missed}</td>
                    <td className={`text-center px-2 ${s.noFollowUp ? 'text-red-600 font-semibold' : ''}`}>{s.noFollowUp}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )

  return (
    <CuttingEdgeStaffShell viewer={viewer} from={from} wide breadcrumbs={[{ label: 'Cutting Edge Talks' }]}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Cutting Edge Talks</h1>
          <p className="text-sm text-muted-text mt-1">
            Guest-speaker events shared by every class. Students RSVP, submit a question in advance, and say thank you afterward.
          </p>
        </div>
        {viewer.canEdit && (
          <Link
            href={withFrom('/instructor/cutting-edge-talks/new', from)}
            className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 transition-opacity"
          >
            + New event
          </Link>
        )}
      </div>
      <div className="mb-6">
        <ClassFilter courses={courseOptions} value={course} />
      </div>
      {section('Upcoming', upcoming)}
      {section('Past', past)}
    </CuttingEdgeStaffShell>
  )
}
