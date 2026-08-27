'use client'

import { useState } from 'react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceArea } from 'recharts'
import type { ReadinessHistoryPoint, EscalationEventRecord } from '@/lib/readiness-actions'
import type { Zone } from '@/lib/readiness'

export const READINESS_COLOR = '#6D2B5E' // --color-teal-primary (plum)

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

function EscalationHistoryItem({ event }: { event: EscalationEventRecord }) {
  const [expanded, setExpanded] = useState(false)
  const hasCheckin = !!event.checkin

  return (
    <li className="text-sm">
      <div className="flex items-start gap-2">
        <span className="text-muted-text shrink-0 w-32">
          {new Date(event.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <span className="text-dark-text">
          {ESCALATION_EVENT_LABEL[event.eventType] ?? event.eventType}
          {event.note && <span className="text-muted-text"> — {event.note}</span>}
          {hasCheckin && (
            <button
              type="button"
              onClick={() => setExpanded(x => !x)}
              className="ml-2 text-xs font-semibold text-teal-primary hover:underline"
            >
              {expanded ? 'Hide response' : 'View response →'}
            </button>
          )}
        </span>
      </div>

      {hasCheckin && expanded && event.checkin && (
        <div className="mt-2 ml-[8.5rem] rounded-lg border border-border bg-background p-3 text-sm space-y-1.5">
          {event.checkin.note && <p><span className="font-semibold text-dark-text">Notes: </span><span className="text-muted-text">{event.checkin.note}</span></p>}
          {event.checkin.obstacles && <p><span className="font-semibold text-dark-text">What got in the way: </span><span className="text-muted-text">{event.checkin.obstacles}</span></p>}
          {event.checkin.goals && <p><span className="font-semibold text-dark-text">Goals: </span><span className="text-muted-text">{event.checkin.goals}</span></p>}
          {event.checkin.reflection && <p><span className="font-semibold text-dark-text">Reflection: </span><span className="text-muted-text">{event.checkin.reflection}</span></p>}
          {!event.checkin.note && !event.checkin.obstacles && !event.checkin.goals && !event.checkin.reflection && (
            <p className="text-muted-text italic">No notes were left.</p>
          )}
        </div>
      )}
    </li>
  )
}

/** Collapsible "here's everything that's happened" timeline -- shared by the student and staff views. */
export function EscalationHistorySection({ events }: { events: EscalationEventRecord[] }) {
  const [open, setOpen] = useState(false)
  if (events.length === 0) return null

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
        <ul className="mt-3 space-y-2">
          {[...events].reverse().map(e => <EscalationHistoryItem key={e.id} event={e} />)}
        </ul>
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
        <div>Attendance missed: <span className="text-dark-text">{p.attendancePctMissed != null ? `${Math.round(p.attendancePctMissed)}%` : '—'}</span></div>
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
