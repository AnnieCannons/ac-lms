'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  compareLeastActive,
  computeStudyActivity,
  type FlashcardSession,
  type PracticeQuiz,
  type QuizAttempt,
  type StudentRow,
  type StudyRange,
  type StudyStudent,
  type WeekBar,
} from '@/lib/study-activity'

interface Props {
  courseId: string
  students: StudyStudent[]
  quizzes: PracticeQuiz[]
  attempts: QuizAttempt[]
  sessions: FlashcardSession[]
  today: string
  courseStart: string
}

const RANGES: { value: StudyRange; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '28', label: 'Last 4 weeks' },
  { value: 'all', label: 'Whole course' },
]

type SortKey = 'least' | 'most' | 'name' | 'activeDays' | 'quizAttempts' | 'cardsStudied' | 'lastActive'

const TICK = { fontSize: 11, fill: 'var(--color-muted-text)' }

const day = (date: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' })
}

function relative(at: string | null, today: string): string {
  if (!at) return 'Never'
  const d = new Date(at).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const diff = Math.round((Date.parse(today) - Date.parse(d)) / 86400000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 14) return `${diff} days ago`
  return day(d)
}

const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n)}%`)

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface rounded-2xl border border-border px-5 py-4">
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-dark-text mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-text mt-0.5">{sub}</p>}
    </div>
  )
}

function WeekTooltip({ active, payload, enrolled }: { active?: boolean; payload?: { payload: WeekBar }[]; enrolled: number }) {
  if (!active || !payload?.length) return null
  const w = payload[0].payload
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-dark-text">Week of {day(w.week)}</p>
      <p className="text-dark-text mt-1">{w.studied} of {enrolled} students studied</p>
      <p className="text-muted-text">{w.quizStudents} took a practice quiz</p>
      <p className="text-muted-text">{w.cardStudents} studied flashcards</p>
    </div>
  )
}

function Strip({ strip }: { strip: StudentRow['strip'] }) {
  const active = strip.filter(s => s.quiz || s.cards).length
  return (
    <div className="flex gap-[2px]" role="img" aria-label={`Active ${active} of the last ${strip.length} days`}>
      {strip.map(s => {
        const what = [s.quiz && 'practice quiz', s.cards && 'flashcards'].filter(Boolean).join(' + ')
        return (
          <span
            key={s.date}
            title={`${day(s.date, { weekday: 'short', month: 'short', day: 'numeric' })}: ${what || 'no studying'}`}
            className={`w-[7px] h-4 rounded-[2px] ${what ? 'bg-teal-primary' : 'bg-border'}`}
          />
        )
      })}
    </div>
  )
}

export default function StudyActivityView({ courseId, students, quizzes, attempts, sessions, today, courseStart }: Props) {
  const [range, setRange] = useState<StudyRange>('28')
  const [tab, setTab] = useState<'students' | 'quizzes'>('students')
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'least', desc: false })
  const [open, setOpen] = useState<string | null>(null)
  const [openQuiz, setOpenQuiz] = useState<string | null>(null)

  const data = useMemo(
    () => computeStudyActivity({ students, quizzes, attempts, sessions, today, courseStart, range }),
    [students, quizzes, attempts, sessions, today, courseStart, range],
  )
  const { summary } = data
  const rangeLabel = RANGES.find(r => r.value === range)!.label.toLowerCase()

  const rows = useMemo(() => {
    const r = [...data.students]
    const by: Record<SortKey, (a: StudentRow, b: StudentRow) => number> = {
      least: compareLeastActive,
      // Most active first: most active days, then most recent activity, names A–Z on ties.
      most: (a, b) => a.activeDays !== b.activeDays ? b.activeDays - a.activeDays : (b.lastActive ?? '').localeCompare(a.lastActive ?? ''),
      name: (a, b) => a.name.localeCompare(b.name),
      activeDays: (a, b) => a.activeDays - b.activeDays,
      quizAttempts: (a, b) => a.quizAttempts - b.quizAttempts,
      cardsStudied: (a, b) => a.cardsStudied - b.cardsStudied,
      lastActive: (a, b) => (a.lastActive ?? '').localeCompare(b.lastActive ?? ''),
    }
    r.sort((a, b) => (sort.desc ? -1 : 1) * by[sort.key](a, b) || a.name.localeCompare(b.name))
    return r
  }, [data.students, sort])

  const sortBy = (key: SortKey) =>
    setSort(s => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' && key !== 'least' && key !== 'most' }))

  const header = (key: SortKey, label: string, align = 'text-left') => (
    <th
      className={`${align} px-4 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide`}
      aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : undefined}
    >
      <button type="button" onClick={() => sortBy(key)} className="uppercase tracking-wide hover:text-dark-text">
        {label}
        {sort.key === key && <span aria-hidden="true"> {sort.desc ? '↓' : '↑'}</span>}
      </button>
    </th>
  )

  const prevSub =
    summary.studiedPrev == null
      ? undefined
      : summary.studied === summary.studiedPrev
        ? 'Same as the period before'
        : `${summary.studied > summary.studiedPrev ? 'Up' : 'Down'} from ${summary.studiedPrev} the period before`

  if (students.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-12 text-center text-sm text-muted-text">
        No students are enrolled in this course yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label="Date range" className="inline-flex self-start rounded-lg border border-border bg-surface p-0.5">
        {RANGES.map(r => (
          <button
            key={r.value}
            type="button"
            aria-pressed={range === r.value}
            onClick={() => setRange(r.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              range === r.value ? 'bg-teal-light text-teal-primary' : 'text-muted-text hover:text-dark-text'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile
          label="Studied"
          value={`${summary.studied} of ${summary.enrolled}`}
          sub={prevSub ?? `Students active in the ${rangeLabel}`}
        />
        <Tile label="Quiet 7+ days" value={String(summary.quiet7)} sub="No practice quizzes or flashcards this week" />
        <Tile
          label="Typical student"
          value={`${summary.medianActiveDays} ${summary.medianActiveDays === 1 ? 'day' : 'days'}`}
          sub={`Median active days, ${rangeLabel}`}
        />
        <Tile
          label="Activity"
          value={`${data.students.reduce((n, s) => n + s.quizAttempts, 0)} quiz attempts`}
          sub={`${data.students.reduce((n, s) => n + s.cardsStudied, 0).toLocaleString()} flashcards reviewed`}
        />
      </div>

      <div className="bg-surface rounded-2xl border border-border px-5 pt-4 pb-2">
        <h2 className="font-semibold text-dark-text">Students who studied each week</h2>
        <p className="text-xs text-muted-text">Out of {summary.enrolled} enrolled · weeks start Monday</p>
        <div className="h-48 mt-3" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.weeks} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barCategoryGap="25%">
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="week" tickFormatter={w => day(w)} tick={TICK} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
              <YAxis domain={[0, summary.enrolled]} allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
              <Tooltip content={<WeekTooltip enrolled={summary.enrolled} />} cursor={{ fill: 'var(--color-teal-light)' }} />
              <Bar dataKey="studied" fill="var(--color-teal-primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="sr-only">
          <caption>Students who studied each week</caption>
          <thead><tr><th>Week of</th><th>Studied</th><th>Practice quiz</th><th>Flashcards</th></tr></thead>
          <tbody>
            {data.weeks.map(w => (
              <tr key={w.week}><td>{day(w.week)}</td><td>{w.studied}</td><td>{w.quizStudents}</td><td>{w.cardStudents}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-2 px-4 pt-3 border-b border-border">
        <div role="group" aria-label="Study activity views" className="flex gap-1">
          {([['students', 'Students'], ['quizzes', 'By practice quiz']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === value ? 'border-teal-primary text-teal-primary' : 'border-transparent text-muted-text hover:text-dark-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'students' && (
          <div role="group" aria-label="Order students" className="inline-flex mb-2 rounded-lg border border-border bg-surface p-0.5">
            {([['least', 'Least active first'], ['most', 'Most active first']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={sort.key === key}
                onClick={() => setSort({ key, desc: false })}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  sort.key === key ? 'bg-teal-light text-teal-primary' : 'text-muted-text hover:text-dark-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        </div>

        {tab === 'students' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {header('name', 'Student')}
                  {header('activeDays', 'Active days', 'text-right')}
                  <th className="text-left px-4 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide">Last 28 days</th>
                  {header('quizAttempts', 'Quiz attempts', 'text-right')}
                  {header('cardsStudied', 'Flashcards', 'text-right')}
                  {header('lastActive', 'Last active')}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(r => {
                  const isOpen = open === r.id
                  return (
                    <Fragment key={r.id}>
                      <tr className="hover:bg-border/10">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : r.id)}
                            aria-expanded={isOpen}
                            className="flex items-center gap-1.5 font-medium text-dark-text hover:text-teal-primary text-left"
                          >
                            <span aria-hidden="true" className="text-[9px] text-muted-text w-2">{isOpen ? '▼' : '▶'}</span>
                            {r.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right text-dark-text tabular-nums">{r.activeDays}</td>
                        <td className="px-4 py-3"><Strip strip={r.strip} /></td>
                        <td className="px-4 py-3 text-right text-dark-text tabular-nums">{r.quizAttempts}</td>
                        <td className="px-4 py-3 text-right text-dark-text tabular-nums">
                          {r.cardsStudied.toLocaleString()}
                          {r.flashcardSessions > 0 && (
                            <span className="block text-xs text-muted-text">
                              {r.flashcardSessions} {r.flashcardSessions === 1 ? 'session' : 'sessions'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-text whitespace-nowrap">{relative(r.lastActive, today)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-background/60">
                          <td colSpan={6} className="px-10 py-3">
                            {r.quizzes.length === 0 ? (
                              <p className="text-sm text-muted-text">No practice quiz attempts in the {rangeLabel}.</p>
                            ) : (
                              <ul className="flex flex-col gap-1 text-sm">
                                {r.quizzes.map(q => (
                                  <li key={q.quizId} className="flex flex-wrap gap-x-3">
                                    <span className="text-dark-text">{q.title}</span>
                                    <span className="text-muted-text">
                                      {q.attempts} {q.attempts === 1 ? 'attempt' : 'attempts'} · best {pct(q.best)} · last {relative(q.lastAt, today).toLowerCase()}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <Link href={`/instructor/courses/${courseId}/roster/${r.id}`} className="inline-block mt-2 text-xs text-teal-primary hover:underline">
                              Open student page →
                            </Link>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : data.quizzes.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-text">No published practice quizzes in this course yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide">Practice quiz</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide">Students</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide">Attempts</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide">Avg first score</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide">Avg best score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.quizzes.map(q => {
                  const isOpen = openQuiz === q.quizId
                  return (
                    <Fragment key={q.quizId}>
                      <tr className="hover:bg-border/10">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setOpenQuiz(isOpen ? null : q.quizId)}
                            aria-expanded={isOpen}
                            className="flex items-start gap-1.5 text-left group"
                          >
                            <span aria-hidden="true" className="text-[9px] text-muted-text w-2 mt-1.5">{isOpen ? '▼' : '▶'}</span>
                            <span>
                              <span className="block font-medium text-dark-text group-hover:text-teal-primary">{q.title}</span>
                              {q.moduleTitle && <span className="block text-xs text-muted-text">{q.moduleTitle}</span>}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right text-dark-text tabular-nums">{q.students} of {summary.enrolled}</td>
                        <td className="px-4 py-3 text-right text-dark-text tabular-nums">{q.attempts}</td>
                        <td className="px-4 py-3 text-right text-dark-text tabular-nums">{pct(q.avgFirst)}</td>
                        <td className="px-4 py-3 text-right text-dark-text tabular-nums">{pct(q.avgBest)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-background/60">
                          <td colSpan={5} className="px-10 py-3">
                            {q.takers.length === 0 ? (
                              <p className="text-sm text-muted-text">No one took this quiz in the {rangeLabel}.</p>
                            ) : (
                              <ul className="flex flex-col gap-1 text-sm">
                                {q.takers.map(t => (
                                  <li key={t.studentId} className="flex flex-wrap gap-x-3">
                                    <Link href={`/instructor/courses/${courseId}/roster/${t.studentId}`} className="text-dark-text hover:text-teal-primary hover:underline">
                                      {t.name}
                                    </Link>
                                    <span className="text-muted-text">
                                      {t.attempts} {t.attempts === 1 ? 'attempt' : 'attempts'} · first {pct(t.first)} · best {pct(t.best)} · last {relative(t.lastAt, today).toLowerCase()}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
