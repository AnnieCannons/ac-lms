'use client'

import { useState } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { StudentRow, StudentWeek, StudentWeekDay } from '@/lib/study-activity'

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

const dayAnchor = (studentId: string, date: string) => `study-day-${studentId}-${date}`

/** Monday to Sunday of one week, with each day's attempts and cards. Days that studied jump to that day in the list. */
function WeekDays({ week, onPick }: { week: StudentWeek; onPick: (date: string) => void }) {
  return (
    <ol className="grid grid-cols-7 gap-1 sm:gap-1.5">
      {week.days.map((d: StudentWeekDay) => {
        const studied = d.quizAttempts > 0 || d.cards > 0
        const label = day(d.date, { weekday: 'short', month: 'short', day: 'numeric' })
        const body = (
          <>
            <span className="block text-[11px] font-semibold text-muted-text">{day(d.date, { weekday: 'short' })}</span>
            <span className="block text-[11px] text-muted-text">{day(d.date)}</span>
            {d.inRange ? (
              <span className="mt-1 flex flex-col gap-0.5 text-[11px] leading-tight">
                {d.quizAttempts > 0 && (
                  <span className="inline-flex items-center gap-1 text-dark-text">
                    <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: QUIZ }} />
                    {plural(d.quizAttempts, 'quiz', 'quizzes')}
                  </span>
                )}
                {d.cards > 0 && (
                  <span className="inline-flex items-center gap-1 text-dark-text">
                    <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CARDS }} />
                    {plural(d.cards, 'card')}
                  </span>
                )}
                {!studied && <span className="text-muted-text">—</span>}
              </span>
            ) : (
              <span className="mt-1 block text-[11px] text-muted-text/60">·</span>
            )}
          </>
        )
        const base = 'w-full h-full min-h-[4.5rem] rounded-lg border px-1.5 py-1 text-left'
        return (
          <li key={d.date} aria-label={!studied ? `${label}: ${d.inRange ? 'no studying' : 'outside the range'}` : undefined}>
            {studied ? (
              <button
                type="button"
                onClick={() => onPick(d.date)}
                aria-label={`${label}: ${[d.quizAttempts > 0 && plural(d.quizAttempts, 'practice quiz attempt'), d.cards > 0 && plural(d.cards, 'flashcard')].filter(Boolean).join(', ')}. Show what they studied`}
                className={`${base} border-border bg-surface hover:border-teal-primary focus-visible:outline-2 focus-visible:outline-teal-primary`}
              >
                {body}
              </button>
            ) : (
              <div className={`${base} border-dashed border-border/60 ${d.inRange ? '' : 'opacity-50'}`}>{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** One student's studying in the selected range: days per week as two lines, then day by day. */
export default function StudyStudentDetail({ row, courseId, rangeLabel }: { row: StudentRow; courseId: string; rangeLabel: string }) {
  const [showAll, setShowAll] = useState(false)
  const days = showAll ? row.timeline : row.timeline.slice(0, DAYS_SHOWN)
  // The week shown day by day, by its Monday: the latest one unless the chart or the arrows pick another
  const [pickedWeek, setPickedWeek] = useState<string | null>(null)
  const found = row.weeks.findIndex(w => w.week === pickedWeek)
  const weekIdx = found >= 0 ? found : row.weeks.length - 1
  const shownWeek = row.weeks[weekIdx]
  const goToWeek = (i: number) => row.weeks[i] && setPickedWeek(row.weeks[i].week)

  const pickDay = (date: string) => {
    if (!showAll && row.timeline.findIndex(d => d.date === date) >= DAYS_SHOWN) flushSync(() => setShowAll(true))
    const el = document.getElementById(dayAnchor(row.id, date))
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    el?.focus({ preventScroll: true })
  }

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
              <LineChart
                data={row.weeks}
                onClick={state => {
                  const i = Number(state?.activeTooltipIndex)
                  if (Number.isInteger(i)) goToWeek(i)
                }}
                className="cursor-pointer"
                margin={{ top: 8, right: 12, bottom: 0, left: -24 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="week" tickFormatter={w => day(w)} tick={TICK} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
                <YAxis domain={[0, 7]} ticks={[0, 1, 2, 3, 4, 5, 6, 7]} allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
                <Tooltip content={<WeekTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
                <Line type="monotone" dataKey="quizDays" stroke={QUIZ} strokeWidth={2} dot={{ r: 3.5, fill: QUIZ, strokeWidth: 0 }} activeDot={{ r: 5, stroke: 'var(--color-surface)', strokeWidth: 2 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="cardDays" stroke={CARDS} strokeWidth={2} strokeDasharray={CARDS_DASH} dot={{ r: 3.5, fill: CARDS, strokeWidth: 0 }} activeDot={{ r: 5, stroke: 'var(--color-surface)', strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-text pb-1">Weeks start Monday. Hover a week for attempts and cards; click one to see its days below.</p>
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

      {shownWeek && (
        <div className="bg-surface rounded-xl border border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-dark-text">Day by day · week of {day(shownWeek.week)}</h3>
            {row.weeks.length > 1 && (
              <div className="flex gap-1">
                <button type="button" onClick={() => goToWeek(weekIdx - 1)} disabled={weekIdx <= 0}
                  aria-label="Previous week" className="px-2 py-0.5 rounded border border-border text-xs text-dark-text disabled:opacity-40 hover:border-teal-primary">←</button>
                <button type="button" onClick={() => goToWeek(weekIdx + 1)} disabled={weekIdx >= row.weeks.length - 1}
                  aria-label="Next week" className="px-2 py-0.5 rounded border border-border text-xs text-dark-text disabled:opacity-40 hover:border-teal-primary">→</button>
              </div>
            )}
          </div>
          <WeekDays week={shownWeek} onPick={pickDay} />
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-dark-text mb-2">What they studied</h3>
        {row.timeline.length === 0 ? (
          <p className="text-sm text-muted-text">No practice quizzes or flashcards in the {rangeLabel}.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {days.map(d => (
              <li key={d.date} id={dayAnchor(row.id, d.date)} tabIndex={-1} className="grid grid-cols-[5.5rem_1fr] gap-x-3 text-sm rounded scroll-mt-4 focus:outline-none focus:ring-2 focus:ring-teal-primary">
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
