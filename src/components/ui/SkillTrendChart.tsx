'use client'

import { useEffect, useRef } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { formatTimestamp, type SkillTrend } from '@/lib/confidence-trend'

interface Point {
  x: number
  rating: number
  date: string
  detail: string
}

const DAY = 86400000
const HEIGHT = 190
const X_AXIS_HEIGHT = 30
const MARGIN = { top: 46, right: 12, bottom: 4, left: 0 }
// From this many ratings the plot scrolls sideways (one step per rating) instead of squeezing,
// with the vertical axis kept fixed on the left.
const SCROLL_FROM = 30
const STEP_PX = 40
const Y_AXIS_WIDTH = 40
const Y_TICKS = [0, 2, 4, 6, 8, 10]
const TICK = { fontSize: 11, fill: 'var(--color-muted-text)' }
// Course labels rotate through three rows above the plot so neighbours don't overlap.
const LABEL_OFFSETS = [4, 16, 28]

const shortLabel = (label: string, max = 34) => (label.length > max ? `${label.slice(0, max - 1)}…` : label)

// Ratings are evenly spaced (rating 1, 2, 3 …) with the date shown under each, so idle stretches
// don't leave gaps. Course dividers and mastery/reactivation markers are lines at whole or half
// steps along that axis; the first course's name is written at the start.
export default function SkillTrendChart({ trend }: { trend: SkillTrend }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const data: Point[] = trend.ratings.map((r, i) => ({
    x: i + 1,
    rating: r.value,
    date: formatTimestamp(r.date),
    detail: r.assignmentTitle ?? 'Removed assignment',
  }))
  const n = data.length
  const scrollable = n >= SCROLL_FROM
  const spanDays = (Date.parse(trend.ratings[n - 1].date) - Date.parse(trend.ratings[0].date)) / DAY
  const ticks = data.map(d => d.x).filter((_, i) => (scrollable ? i % 2 === 0 : n <= 10 || i % Math.ceil(n / 10) === 0))
  const formatTick = (x: number) => {
    const r = trend.ratings[x - 1]
    if (!r) return ''
    return new Date(r.date).toLocaleDateString('en-US', spanDays > 330 ? { month: 'short', day: 'numeric', year: '2-digit' } : { month: 'short', day: 'numeric' })
  }
  const goal = trend.currentGoal?.goal ?? null
  const summary = `${trend.name} ratings over time: ${data.map(d => `${d.rating} on ${d.date}`).join(', ')}.`

  // Start on the most recent ratings when the plot scrolls.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [scrollable, n])

  const plot = (size: { width?: number; height?: number }, hideYAxis: boolean) => (
    <LineChart {...size} data={data} margin={hideYAxis ? { ...MARGIN, left: 8 } : MARGIN}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
      <XAxis
        type="number"
        dataKey="x"
        domain={[0.5, n + 0.5]}
        ticks={ticks}
        allowDecimals={false}
        tickFormatter={formatTick}
        tick={TICK}
        height={X_AXIS_HEIGHT}
        stroke="var(--color-border)"
      />
      <YAxis hide={hideYAxis} domain={[0, 10]} ticks={Y_TICKS} tick={TICK} stroke="var(--color-border)" />
      <Tooltip
        contentStyle={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '4px 8px', background: 'var(--color-surface)', color: 'var(--color-dark-text)', fontSize: 11, lineHeight: 1.3 }}
        labelStyle={{ margin: 0, fontSize: 11 }}
        itemStyle={{ padding: 0, fontSize: 11 }}
        formatter={(v) => [v, 'Confidence']}
        labelFormatter={(_: unknown, payload: readonly { payload?: Point }[]) => {
          const p = payload?.[0]?.payload
          return p ? p.detail : ''
        }}
      />
      {goal !== null && (
        <ReferenceLine
          y={goal}
          stroke="var(--color-teal-primary)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          label={{ value: `Goal ${goal}`, position: 'insideTopRight', fontSize: 10, fontWeight: 600, fill: 'var(--color-teal-primary)' }}
        />
      )}
      {trend.startCourseName && (
        // Invisible line at the very start, only there to carry the first course's name.
        <ReferenceLine
          x={0.5}
          stroke="none"
          label={{ value: shortLabel(trend.startCourseName), position: 'top', offset: LABEL_OFFSETS[0], textAnchor: 'start', fontSize: 10, fill: 'var(--color-muted-text)' }}
        />
      )}
      {trend.courseBreakpoints.map((b, i) => (
        <ReferenceLine
          key={`course-${b.x}`}
          x={b.x}
          stroke="var(--color-muted-text)"
          strokeDasharray="4 3"
          // The label reads after the line; near the right edge of a squeezed chart it is shortened
          // so it isn't clipped.
          label={{ value: shortLabel(b.label, !scrollable && b.x > n * 0.6 ? 20 : 34), position: 'top', offset: LABEL_OFFSETS[(i + 1) % LABEL_OFFSETS.length], textAnchor: 'start', fontSize: 10, fill: 'var(--color-muted-text)' }}
        />
      ))}
      {trend.events.map(e => (
        <ReferenceLine
          key={`${e.type}-${e.date}`}
          x={e.x}
          stroke="var(--color-purple-primary)"
          strokeWidth={2}
          // A reactivation sits half a step after the mastery it follows, so its label goes low to
          // keep the two apart.
          label={{ value: e.label, position: e.type === 'mastered' ? 'insideTopRight' : 'insideBottomRight', fontSize: 10, fill: 'var(--color-purple-primary)' }}
        />
      ))}
      <Line
        type="monotone"
        dataKey="rating"
        stroke="var(--color-teal-primary)"
        strokeWidth={3}
        dot={{ fill: 'var(--color-teal-primary)', strokeWidth: n > 12 ? 1 : 2, r: n > 12 ? 3 : 5, stroke: 'var(--color-border)' }}
        activeDot={{ r: n > 12 ? 5 : 7 }}
      />
    </LineChart>
  )

  return (
    <div role="img" aria-label={summary} className="bg-teal-light/40 rounded-xl p-3 border-2 border-border">
      {scrollable ? (
        <div className="flex" data-testid="trend-chart-scroll">
          {/* Fixed vertical axis: a chart with the same height and margins that draws only the axis. */}
          <div className="shrink-0">
            <LineChart width={Y_AXIS_WIDTH} height={HEIGHT} data={data} margin={{ ...MARGIN, right: 0 }}>
              <XAxis type="number" dataKey="x" domain={[0.5, n + 0.5]} height={X_AXIS_HEIGHT} tick={false} tickLine={false} axisLine={false} />
              <YAxis width={Y_AXIS_WIDTH} domain={[0, 10]} ticks={Y_TICKS} tick={TICK} stroke="var(--color-border)" />
              {/* Axes only render alongside a series, so add an invisible one. */}
              <Line dataKey="rating" stroke="none" dot={false} activeDot={false} isAnimationActive={false} />
            </LineChart>
          </div>
          <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto">
            {plot({ width: n * STEP_PX + 20, height: HEIGHT }, true)}
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={HEIGHT}>
          {plot({}, false)}
        </ResponsiveContainer>
      )}
    </div>
  )
}
