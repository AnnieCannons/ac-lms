'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceArea } from 'recharts'
import { Send, Bell, CheckCircle2, ArrowUpCircle, PartyPopper, MessageSquare, CalendarX, FileX, RotateCcw, type LucideIcon } from 'lucide-react'
import { MISSING_COLOR, NEEDS_REVISION_COLOR, ABSENCE_COLOR } from '@/components/ui/StudentStatsWidgets'
import type { ReadinessHistoryPoint, EscalationEventRecord } from '@/lib/readiness-actions'
import type { Zone } from '@/lib/readiness'

export const READINESS_COLOR = '#6D2B5E' // --color-teal-primary (plum)

const HOW_IT_WORKS_STORAGE_KEY = 'readiness-how-it-works-collapsed'

function FormulaRow({ icon: Icon, color, children }: { icon: LucideIcon; color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}1A` }}>
        <Icon size={13} strokeWidth={2.25} style={{ color }} aria-hidden="true" />
      </span>
      <span className="text-sm text-dark-text">{children}</span>
    </div>
  )
}

/** The "how this works" explainer, shown near the top of both the student and staff
 * readiness views. Expanded by default -- a checkbox lets the viewer opt out of that
 * for next time (remembered per-browser via localStorage). */
export function HowThisWorksSection({ audience }: { audience: 'student' | 'staff' }) {
  const [open, setOpen] = useState(true)
  const [rememberCollapsed, setRememberCollapsed] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HOW_IT_WORKS_STORAGE_KEY) === 'true'
      setRememberCollapsed(stored)
      if (stored) setOpen(false)
    } catch { /* localStorage unavailable -- just keep the default expanded state */ }
  }, [])

  const toggleRemember = (checked: boolean) => {
    setRememberCollapsed(checked)
    try { localStorage.setItem(HOW_IT_WORKS_STORAGE_KEY, String(checked)) } catch { /* ignore */ }
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-5 mb-6">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="font-bold text-dark-text">How this works</span>
        <span className="text-xs font-semibold text-teal-primary">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-text mb-2">The score starts at 5, then loses a point for every:</p>
            <div className="space-y-2">
              <FormulaRow icon={CalendarX} color={ABSENCE_COLOR}>12% of class blocks missed that week</FormulaRow>
              <FormulaRow icon={FileX} color={MISSING_COLOR}>3 missing assignments</FormulaRow>
              <FormulaRow icon={RotateCcw} color={NEEDS_REVISION_COLOR}>2 assignments still needing revision</FormulaRow>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-text mb-2">Bands</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-dark-text">
              <span className="flex items-center gap-1.5"><ReadinessZoneBadge zone="green" /> 4–5</span>
              <span className="flex items-center gap-1.5"><ReadinessZoneBadge zone="yellow" /> 2–3</span>
              <span className="flex items-center gap-1.5"><ReadinessZoneBadge zone="red" /> 1</span>
            </div>
          </div>

          {audience === 'student' ? (
            <div className="rounded-xl bg-teal-light p-3.5 text-sm text-dark-text">
              A rough week doesn&apos;t define your progress — every week is a fresh chance to catch up and get back on track.
              If your score stays low, we&apos;ll check in with a quick form, and if needed, a short reflection, just to see how we can help.
              Two strong weeks in a row brings you right back to a clean slate.
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-text mb-2">Escalation</p>
              <ul className="text-sm text-dark-text space-y-1 list-disc pl-4">
                <li>Score of 1 (red) triggers a check-in immediately.</li>
                <li>2-3 (yellow) triggers only if it&apos;s 2 of the last 4 weeks — one isolated dip doesn&apos;t.</li>
                <li>Step 1 (quick check-in) → step 2 (reflection): advances after a week with no improvement; one grace week is given if they moved to a better band but aren&apos;t fully green yet.</li>
                <li>Step 2 → step 3 (staff meeting request): advances immediately on any non-green week — no grace period.</li>
                <li>2 consecutive green weeks resets the process at any step.</li>
              </ul>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-muted-text pt-1">
            <input
              type="checkbox"
              checked={rememberCollapsed}
              onChange={e => toggleRemember(e.target.checked)}
              className="accent-teal-primary"
            />
            Don&apos;t show this expanded automatically
          </label>
        </div>
      )}
    </div>
  )
}

export const ESCALATION_EVENT_LABEL: Record<string, string> = {
  step1_started: 'Step 1 check-in sent',
  step1_reminder: 'Step 1 reminder sent',
  step1_completed: 'Step 1 check-in completed',
  step2_started: 'Advanced to step 2 — reflection sent',
  step2_reminder: 'Step 2 reminder sent',
  step2_completed: 'Step 2 reflection completed',
  step3_started: 'Advanced to step 3 — meeting requested',
  reset: 'Reset to good standing',
  manual_note: 'Note',
}

const EVENT_ICON: Record<string, { icon: LucideIcon; color: string }> = {
  step1_started: { icon: Send, color: '#ea580c' },
  step1_reminder: { icon: Bell, color: '#f59e0b' },
  step1_completed: { icon: CheckCircle2, color: '#16a34a' },
  step2_started: { icon: ArrowUpCircle, color: '#ea580c' },
  step2_reminder: { icon: Bell, color: '#f59e0b' },
  step2_completed: { icon: CheckCircle2, color: '#16a34a' },
  step3_started: { icon: ArrowUpCircle, color: '#dc2626' },
  reset: { icon: PartyPopper, color: '#16a34a' },
  manual_note: { icon: MessageSquare, color: '#6B5D80' },
}

function formatCompactDate(iso: string): { short: string; full: string } {
  const date = new Date(iso)
  const full = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (diffDays <= 0) return { short: 'Today', full }
  if (diffDays === 1) return { short: 'Yesterday', full }
  if (diffDays < 7) return { short: `${diffDays}d ago`, full }
  if (diffDays < 30) return { short: `${Math.floor(diffDays / 7)}w ago`, full }
  return { short: full, full }
}

function EscalationHistoryItem({ event, isLast }: { event: EscalationEventRecord; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const hasCheckin = !!event.checkin
  const { icon: Icon, color } = EVENT_ICON[event.eventType] ?? { icon: MessageSquare, color: '#6B5D80' }
  const { short, full } = formatCompactDate(event.createdAt)

  return (
    <li className="flex gap-3">
      {/* Icon + connecting line share one flex column, so the line's length is
          real layout (fills whatever space is left below the icon) rather than
          a guessed pixel offset -- stays correct no matter how tall the
          content next to it is. */}
      <div className="flex flex-col items-center shrink-0">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${color}1A` }}
        >
          <Icon size={14} strokeWidth={2.25} style={{ color }} aria-hidden="true" />
        </span>
        {!isLast && <span className="flex-1 w-px bg-border" aria-hidden="true" />}
      </div>

      <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-4'}`}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-dark-text font-medium">{ESCALATION_EVENT_LABEL[event.eventType] ?? event.eventType}</span>
          <span className="text-xs text-muted-text" title={full}>{short}</span>
        </div>
        {event.note && <p className="text-muted-text text-xs mt-0.5">{event.note}</p>}
        {hasCheckin && (
          <button
            type="button"
            onClick={() => setExpanded(x => !x)}
            className="mt-1 text-xs font-semibold text-teal-primary hover:underline"
          >
            {expanded ? 'Hide response' : 'View response →'}
          </button>
        )}

        {hasCheckin && expanded && event.checkin && (
          <div className="mt-2 rounded-lg border border-border bg-background p-3 text-sm space-y-1.5">
            {event.checkin.note && <p><span className="font-semibold text-dark-text">Notes: </span><span className="text-muted-text">{event.checkin.note}</span></p>}
            {event.checkin.obstacles && <p><span className="font-semibold text-dark-text">What got in the way: </span><span className="text-muted-text">{event.checkin.obstacles}</span></p>}
            {event.checkin.goals && <p><span className="font-semibold text-dark-text">Goals: </span><span className="text-muted-text">{event.checkin.goals}</span></p>}
            {event.checkin.reflection && <p><span className="font-semibold text-dark-text">Reflection: </span><span className="text-muted-text">{event.checkin.reflection}</span></p>}
            {!event.checkin.note && !event.checkin.obstacles && !event.checkin.goals && !event.checkin.reflection && (
              <p className="text-muted-text italic">No notes were left.</p>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

type Cycle = { events: EscalationEventRecord[]; startedAt: string; endedAt: string | null }

/** Groups a flat event list into escalation "episodes" -- each starting at a step1_started
 * and ending at the reset that closes it (or ongoing, if not yet resolved). */
function groupIntoCycles(events: EscalationEventRecord[]): Cycle[] {
  const cycles: Cycle[] = []
  let current: Cycle | null = null

  for (const e of events) {
    if (e.eventType === 'step1_started' || !current) {
      current = { events: [e], startedAt: e.createdAt, endedAt: null }
      cycles.push(current)
      continue
    }
    current.events.push(e)
    if (e.eventType === 'reset') {
      current.endedAt = e.createdAt
      current = null
    }
  }
  return cycles
}

function cycleLabel(cycle: Cycle): string {
  const start = new Date(cycle.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (!cycle.endedAt) return `${start} – present`
  const end = new Date(cycle.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${start} – ${end}`
}

/** Collapsible "here's everything that's happened" timeline -- shared by the student and staff views. */
export function EscalationHistorySection({ events }: { events: EscalationEventRecord[] }) {
  const [open, setOpen] = useState(false)
  if (events.length === 0) return null

  const cycles = [...groupIntoCycles(events)].reverse()

  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-xs font-semibold text-teal-primary hover:underline"
      >
        {open ? '▲ Hide history' : `▼ Show history (${events.length})`}
      </button>
      {open && (
        <div className="mt-3 space-y-5">
          {cycles.map((cycle, i) => {
            const ongoing = !cycle.endedAt && i === 0
            return (
              <div
                key={cycle.events[0].id}
                className={`rounded-xl border p-3.5 ${ongoing ? 'escalation-ongoing-card' : 'border-border bg-background'}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-text">{cycleLabel(cycle)}</span>
                  {ongoing && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full escalation-ongoing-badge">Ongoing</span>
                  )}
                </div>
                <ul className="pl-0.5">
                  {[...cycle.events].reverse().map((e, idx, arr) => (
                    <EscalationHistoryItem key={e.id} event={e} isLast={idx === arr.length - 1} />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatWeekLabel(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ReadinessZoneBadge({ zone }: { zone: Zone | null }) {
  if (zone === 'green') return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">Ready</span>
  if (zone === 'yellow') return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-900">Needs improvement</span>
  if (zone === 'red') return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-200 text-red-900">Not ready this week</span>
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-border/40 text-muted-text">No data yet</span>
}

type TrendPoint = {
  week: string
  score: number
  missing: number
  needsRevision: number
  attendancePctMissed: number | null
  blocksMissed: number | null
  blocksTotal: number | null
}

function formatAttendance(p: TrendPoint): string {
  if (p.blocksTotal != null && p.blocksTotal > 0) {
    const pct = p.attendancePctMissed != null ? Math.round(p.attendancePctMissed) : Math.round((p.blocksMissed ?? 0) / p.blocksTotal * 100)
    return `${p.blocksMissed ?? 0} of ${p.blocksTotal} blocks (${pct}%)`
  }
  return p.attendancePctMissed != null ? `${Math.round(p.attendancePctMissed)}%` : '—'
}

function ReadinessTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrendPoint }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload

  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="font-semibold text-dark-text mb-1.5">Week of {p.week}</div>
      <div className="font-bold mb-1.5" style={{ color: READINESS_COLOR }}>Score: {p.score.toFixed(1)} / 5</div>
      <div className="text-muted-text space-y-0.5">
        <div>Missing: <span className="text-dark-text">{p.missing}</span></div>
        <div>Needs Revision: <span className="text-dark-text">{p.needsRevision}</span></div>
        <div>Attendance missed: <span className="text-dark-text">{formatAttendance(p)}</span></div>
      </div>
    </div>
  )
}

/** Curvy weekly readiness-score trend, 1-5, with the red/yellow/green bands shaded behind it. */
export function ReadinessTrendChart({ history }: { history: ReadinessHistoryPoint[] }) {
  const scored = history.filter(h => h.score != null)
  if (scored.length < 2) {
    return <p className="text-sm text-muted-text py-2">Your trend line appears after a couple weeks of data.</p>
  }

  const data: TrendPoint[] = scored.map(h => ({
    week: formatWeekLabel(h.weekStart),
    score: h.score as number,
    missing: h.missing,
    needsRevision: h.needsRevision,
    attendancePctMissed: h.attendancePctMissed,
    blocksMissed: h.blocksMissed,
    blocksTotal: h.blocksTotal,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
        <ReferenceArea y1={1} y2={2} fill="#dc2626" fillOpacity={0.06} />
        <ReferenceArea y1={2} y2={4} fill="#f59e0b" fillOpacity={0.06} />
        <ReferenceArea y1={4} y2={5} fill="#16a34a" fillOpacity={0.06} />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 11, fill: 'currentColor' }}
          tickLine={false}
          axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
          className="text-muted-text"
        />
        <YAxis
          domain={[1, 5]}
          ticks={[1, 2, 3, 4, 5]}
          tick={{ fontSize: 11, fill: 'currentColor' }}
          tickLine={false}
          axisLine={false}
          width={24}
          className="text-muted-text"
        />
        <Tooltip content={<ReadinessTooltip />} />
        <Line
          type="monotone"
          dataKey="score"
          name="Readiness score"
          stroke={READINESS_COLOR}
          strokeWidth={3}
          dot={{ r: 4, fill: READINESS_COLOR, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
