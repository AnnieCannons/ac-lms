import { notFound } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getCuttingEdgeStaffViewer } from '@/lib/cutting-edge-access'
import { EVENT_COLUMNS, loadEventReport, loadLimitedCourseIds } from '@/lib/cutting-edge-server'
import { formatDueDate, QUESTION_TITLE, summarize, THANKS_TITLE, withFrom, type CuttingEdgeEvent } from '@/lib/cutting-edge'
import CuttingEdgeStaffShell from '@/components/cutting-edge/CuttingEdgeStaffShell'
import LocalEventTime from '@/components/cutting-edge/LocalEventTime'
import ClassFilter from '@/components/cutting-edge/ClassFilter'
import EventStaffActions from '@/components/cutting-edge/EventStaffActions'
import EventStudentTable from '@/components/cutting-edge/EventStudentTable'
import HtmlContent from '@/components/ui/HtmlContent'

function Stat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="bg-surface rounded-xl border border-border px-4 py-3">
      <div className={`text-2xl font-bold ${alert && value > 0 ? 'text-red-600' : 'text-dark-text'}`}>{value}</div>
      <div className="text-xs text-muted-text">{label}</div>
    </div>
  )
}

export default async function CuttingEdgeEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ from?: string; course?: string }>
}) {
  const viewer = await getCuttingEdgeStaffViewer()
  const { eventId } = await params
  const { from, course } = await searchParams
  const admin = createServiceSupabaseClient()
  const now = new Date()

  const { data } = await admin.from('cutting_edge_events').select(EVENT_COLUMNS).eq('id', eventId).maybeSingle()
  if (!data || data.deleted_at) notFound()
  const event = data as CuttingEdgeEvent

  const { rows, courses } = await loadEventReport(admin, event, now)
  const limitedIds = event.audience_all ? [] : await loadLimitedCourseIds(admin, eventId)
  const courseNames = Object.fromEntries(courses.map(c => [c.id, c.name]))
  const classIds = [...new Set(rows.map(r => r.courseId).filter((id): id is string => !!id))]
  const classOptions = courses.filter(c => classIds.includes(c.id)).map(c => ({ id: c.id, name: c.name }))
  const shown = course ? rows.filter(r => r.courseId === course) : rows
  const s = summarize(shown)
  const audienceCount = rows.filter(r => r.inAudience).length

  const padlet = (label: string, url: string | null) => url
    ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-teal-primary underline break-all">{label}</a>
    : <span className="badge-amber border rounded-full px-2 py-0.5 text-xs font-semibold">Padlet link missing</span>

  return (
    <CuttingEdgeStaffShell
      viewer={viewer}
      from={from}
      wide
      breadcrumbs={[{ label: 'Cutting Edge Talks', href: withFrom('/instructor/cutting-edge-talks', from, { course }) }, { label: event.title }]}
    >
      {event.status === 'draft' && (
        <div className="badge-amber border rounded-xl px-4 py-3 mb-6 text-sm">
          <strong>Draft</strong> — students can&apos;t see this talk yet. {viewer.canEdit ? 'Click Publish when it’s ready.' : ''}
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          {event.status === 'published' && (
            <div className="flex items-center gap-2 mb-1">
              <span className="badge-current text-[11px] font-semibold border rounded-full px-2 py-0.5">Published</span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-dark-text">{event.title}</h1>
          <p className="text-sm text-muted-text mt-1"><LocalEventTime iso={event.starts_at} />{event.block ? ` · Block ${event.block}` : ''}{event.speaker ? ` · ${event.speaker}` : ''}</p>
          <p className="text-sm text-muted-text mt-1">
            {event.location_text}
            {event.location_url && <> · <a href={event.location_url} target="_blank" rel="noopener noreferrer" className="text-teal-primary underline">Link</a></>}
          </p>
          <p className="text-xs text-muted-text mt-1">
            For: {event.audience_all ? 'Everyone (all classes running at the time)' : limitedIds.map(id => courseNames[id] ?? 'Unknown class').join(', ')}
          </p>
        </div>
        {viewer.canEdit && (
          <EventStaffActions eventId={event.id} published={event.status === 'published'} firstPublished={!!event.first_published_at} audienceCount={audienceCount} from={from} />
        )}
      </div>

      {event.about_html && (
        <div className="bg-surface rounded-2xl border border-border p-6 mb-6">
          <HtmlContent html={event.about_html} />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-8 text-sm">
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="font-semibold text-dark-text">{QUESTION_TITLE}</p>
          <p className="text-muted-text text-xs mt-1">Due {formatDueDate(event.question_due_date)}</p>
          <p className="mt-2">{padlet('Question Padlet', event.question_padlet_url)}</p>
        </div>
        <div className="bg-surface rounded-xl border border-border p-4">
          <p className="font-semibold text-dark-text">{THANKS_TITLE}</p>
          <p className="text-muted-text text-xs mt-1">Due {formatDueDate(event.thanks_due_date)}</p>
          <p className="mt-2">{padlet('Thank-you Padlet', event.thanks_padlet_url)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-dark-text">Students</h2>
        <ClassFilter courses={classOptions} value={course} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <Stat label="RSVP yes" value={s.yes} />
        <Stat label="RSVP no" value={s.no} />
        <Stat label="No reply" value={s.noResponse} />
        <Stat label="Question submitted" value={s.questionDone} />
        <Stat label="Thanked" value={s.thanked} />
        <Stat label="Said yes, didn’t make it" value={s.missed} />
        <Stat label="Said yes, no follow-up" value={s.noFollowUp} alert />
      </div>
      <EventStudentTable rows={shown} courseNames={courseNames} />
    </CuttingEdgeStaffShell>
  )
}
