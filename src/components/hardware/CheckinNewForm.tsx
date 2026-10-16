'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createHardwareCheckin } from '@/lib/hardware-checkin-actions'
import { formatDateOnly } from '@/lib/hardware'
import type { Person } from '@/lib/hardware-server'
import StudentPicker from './StudentPicker'
import Card from './Card'
import { inputCls, labelCls } from './DeviceForm'

export type CourseOption = { id: string; name: string; start_date: string | null; current: boolean; students: number }

/** Send a check-in: choose courses (current ones first) and add anyone else by name. */
export default function CheckinNewForm({ courses, defaultTitle }: { courses: CourseOption[]; defaultTitle: string }) {
  const router = useRouter()
  const [title, setTitle] = useState(defaultTitle)
  const [courseIds, setCourseIds] = useState<Set<string>>(new Set())
  const [people, setPeople] = useState<Person[]>([])
  const [showOlder, setShowOlder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const toggle = (id: string) => setCourseIds(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const current = courses.filter(c => c.current)
  const older = courses.filter(c => !c.current)
  const fromCourses = courses.filter(c => courseIds.has(c.id)).reduce((n, c) => n + c.students, 0)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await createHardwareCheckin({ title, courseIds: [...courseIds], personIds: people.map(p => p.id) })
    if (!res.ok) { setBusy(false); setError(res.error); return }
    router.push(`/instructor/hardware/check-in/${res.id}?sent=${res.sent}`)
  }

  const courseRow = (c: CourseOption) => (
    <li key={c.id}>
      <label className="flex items-center gap-3 py-1.5 text-sm text-dark-text">
        <input type="checkbox" className="h-4 w-4 accent-teal-primary" checked={courseIds.has(c.id)} onChange={() => toggle(c.id)} />
        <span className="font-medium">{c.name}</span>
        <span className="text-xs text-muted-text">{c.students} {c.students === 1 ? 'student' : 'students'}{c.start_date ? ` · starts ${formatDateOnly(c.start_date)}` : ''}</span>
      </label>
    </li>
  )

  return (
    <form onSubmit={send} className="flex flex-col gap-6">
      <Card title="Name">
        <label className={labelCls}>
          <span className="sr-only">Check-in name</span>
          <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} required />
        </label>
        <p className="text-xs text-muted-text mt-1">Only staff see this name. Students see &ldquo;Equipment check-in&rdquo;.</p>
      </Card>

      <Card title="Which courses?">
        <ul>{current.length ? current.map(courseRow) : <li className="text-sm text-muted-text">No current courses.</li>}</ul>
        {older.length > 0 && (
          <div className="mt-3">
            <button type="button" onClick={() => setShowOlder(v => !v)} className="text-sm font-semibold text-teal-primary hover:underline" aria-expanded={showOlder}>
              {showOlder ? 'Hide older courses' : `Show ${older.length} older courses`}
            </button>
            {showOlder && <ul className="mt-2">{older.map(courseRow)}</ul>}
          </div>
        )}
      </Card>

      <Card title="Anyone else?">
        <p className="text-sm text-muted-text mb-3">For example, alumni who still have a hotspot or booster.</p>
        <StudentPicker
          label="Add a student"
          value={null}
          onChange={p => { if (p && !people.some(x => x.id === p.id)) setPeople(list => [...list, p]) }}
        />
        {people.length > 0 && (
          <ul className="flex flex-wrap gap-2 mt-3">
            {people.map(p => (
              <li key={p.id} className="flex items-center gap-2 text-sm border border-border rounded-full pl-3 pr-1 py-1">
                {p.name ?? p.email}
                <button type="button" onClick={() => setPeople(list => list.filter(x => x.id !== p.id))} aria-label={`Remove ${p.name ?? p.email}`} className="text-muted-text hover:text-red-600 px-1.5">✕</button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || (courseIds.size === 0 && people.length === 0)} className="bg-teal-primary text-white text-sm font-semibold px-6 py-2.5 rounded-full hover:opacity-90 disabled:opacity-60">
          {busy ? 'Sending…' : 'Send check-in'}
        </button>
        <span className="text-sm text-muted-text">
          This will send a Slack message and a bell notification to {fromCourses + people.length === 1 ? 'the student' : `${fromCourses + people.length} students`}.
        </span>
      </div>
    </form>
  )
}
