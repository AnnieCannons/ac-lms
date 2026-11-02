'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { StudentRow, StudentWeek } from '@/lib/study-activity'

const TICK = { fontSize: 11, fill: 'var(--color-muted-text)' }
const QUIZ = 'var(--color-chart-quiz)'
const CARDS = 'var(--color-chart-cards)'
// The two lines differ in dash as well as color, so they read apart without color
const CARDS_DASH = '6 4'
const DAYS_SHOWN = 10

const day = (date: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' })
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`
const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n)}%`)

function LegendKey({ color, dash, label }: { color: string; dash?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-text">
      <svg width="22" height="8" aria-hidden="true">
        <line x1="1" y1="4" x2="21" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dash} strokeLinecap="round" />
      </svg>
      {label}
    </span>
  )
}

function Kind({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 mr-1.5 text-xs font-semibold text-muted-text">
      <span aria-hidden="true" className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function WeekTooltip({ active, payload }: { active?: boolean; payload?: { payload: StudentWeek }[] }) {
  if (!active || !payload?.length) return null
  const w = payload[0].payload
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-dark-text">Week of {day(w.week)}</p>
      <p className="text-dark-text mt-1">
        Practice quizzes: {plural(w.quizDays, 'day')}
        {w.quizAttempts > 0 && <span className="text-muted-text"> · {plural(w.quizAttempts, 'attempt')}</span>}
      </p>
      <p className="text-dark-text">
        Flashcards: {plural(w.cardDays, 'day')}
        {w.cards > 0 && <span className="text-muted-text"> · {plural(w.cards, 'card')}</span>}
      </p>
    </div>
  )
}

/** One student's studying in the selected range: days per week as two lines, then day by day. */
export default function StudyStudentDetail({ row, courseId, rangeLabel }: { row: StudentRow; courseId: string; rangeLabel: string }) {
  const [showAll, setShowAll] = useState(false)
  const days = showAll ? row.timeline : row.timeline.slice(0, DAYS_SHOWN)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-dark-text">
        In the {rangeLabel}, {row.name} studied on {plural(row.activeDays, 'day')}: {plural(row.quizAttempts, 'practice quiz attempt')} and{' '}
        {plural(row.cardsStudied, 'flashcard')} reviewed.
      </p>

      {row.weeks.length > 1 && (
        <div className="bg-surface rounded-xl border border-border px-4 pt-3 pb-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-dark-text">Days studied each week</h3>
            <div className="flex gap-4">
              <LegendKey color={QUIZ} label="Practice quizzes" />
              <LegendKey color={CARDS} dash={CARDS_DASH} label="Flashcards" />
            </div>
          </div>
          <div className="h-44 mt-2" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={row.weeks} margin={{ top: 8, right: 12, bottom: 0, left: -24 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="week" tickFormatter={w => day(w)} tick={TICK} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
                <YAxis domain={[0, 7]} ticks={[0, 1, 2, 3, 4, 5, 6, 7]} allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
                <Tooltip content={<WeekTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
                <Line type="monotone" dataKey="quizDays" stroke={QUIZ} strokeWidth={2} dot={{ r: 3.5, fill: QUIZ, strokeWidth: 0 }} activeDot={{ r: 5, stroke: 'var(--color-surface)', strokeWidth: 2 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="cardDays" stroke={CARDS} strokeWidth={2} strokeDasharray={CARDS_DASH} dot={{ r: 3.5, fill: CARDS, strokeWidth: 0 }} activeDot={{ r: 5, stroke: 'var(--color-surface)', strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-text pb-1">Weeks start Monday. Hover a week for attempts and cards.</p>
          <table className="sr-only">
            <caption>Days {row.name} studied each week</caption>
            <thead><tr><th>Week of</th><th>Practice quiz days</th><th>Quiz attempts</th><th>Flashcard days</th><th>Cards</th></tr></thead>
            <tbody>
              {row.weeks.map(w => (
                <tr key={w.week}><td>{day(w.week)}</td><td>{w.quizDays}</td><td>{w.quizAttempts}</td><td>{w.cardDays}</td><td>{w.cards}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-dark-text mb-2">What they studied</h3>
        {row.timeline.length === 0 ? (
          <p className="text-sm text-muted-text">No practice quizzes or flashcards in the {rangeLabel}.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {days.map(d => (
              <li key={d.date} className="grid grid-cols-[5.5rem_1fr] gap-x-3 text-sm">
                <span className="text-muted-text whitespace-nowrap">{day(d.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <ul className="flex flex-col gap-0.5 min-w-0">
                  {d.quizzes.map(q => (
                    <li key={q.quizId}>
                      <Kind color={QUIZ} label="Practice quiz" />
                      <span className="text-dark-text">{q.title}</span>{' '}
                      <span className="text-muted-text">
                        · {plural(q.scores.length, 'attempt')}: {q.scores.map(pct).join(' → ')}
                      </span>
                    </li>
                  ))}
                  {d.decks.map(k => (
                    <li key={k.title}>
                      <Kind color={CARDS} label="Flashcards" />
                      <span className="text-dark-text">{k.title}</span>{' '}
                      <span className="text-muted-text">· {plural(k.cards, 'card')}{k.sessions > 1 && `, ${k.sessions} sessions`}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
        {row.timeline.length > DAYS_SHOWN && (
          <button type="button" onClick={() => setShowAll(v => !v)} className="mt-2 text-xs text-teal-primary hover:underline">
            {showAll ? 'Show fewer days' : `Show all ${row.timeline.length} days`}
          </button>
        )}
      </div>

      <Link href={`/instructor/courses/${courseId}/roster/${row.id}`} className="self-start text-xs text-teal-primary hover:underline">
        Open student page →
      </Link>
    </div>
  )
}
