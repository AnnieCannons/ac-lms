'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { saveCuttingEdgeEvent } from '@/lib/cutting-edge-actions'
import {
  BLOCKS,
  defaultDueDates,
  QUESTION_TITLE,
  THANKS_TITLE,
  validateEventInput,
  withFrom,
  type EventInput,
} from '@/lib/cutting-edge'

const inputCls = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-dark-text text-sm focus:outline-none focus:border-teal-primary'
const labelCls = 'block text-sm font-semibold text-dark-text mb-1'

const pad = (n: number) => String(n).padStart(2, '0')

/** Date + time in the browser's own timezone → the real instant. */
function localToIso(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return ''
  const d = new Date(`${date}T${time}`)
  return isNaN(d.getTime()) ? '' : d.toISOString()
}

/** The instant → date + time inputs in the browser's own timezone. */
export function isoToLocalInputs(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && <span className="text-red-600" aria-hidden="true"> *</span>}
        {children}
      </label>
      {hint && <p className="text-xs text-muted-text mt-1">{hint}</p>}
    </div>
  )
}

export default function CuttingEdgeEventForm({
  eventId,
  initial,
  courses,
  from,
}: {
  eventId: string | null
  initial: EventInput
  courses: { id: string; name: string }[]
  from?: string
}) {
  const router = useRouter()
  // Rendered client-only (see CuttingEdgeEventFormLoader), so the browser timezone is known here.
  const [form, setForm] = useState<EventInput>(() => initial.startsAt ? { ...initial, ...isoToLocalInputs(initial.startsAt) } : initial)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  // New events keep the due dates following the event date until someone edits them.
  const [dueTouched, setDueTouched] = useState(eventId !== null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof EventInput>(key: K, value: EventInput[K]) => setForm(f => ({ ...f, [key]: value }))

  const setDate = (date: string) => {
    setForm(f => {
      const next = { ...f, date }
      if (!dueTouched && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const d = defaultDueDates(date)
        next.questionDueDate = d.questionDueDate
        next.thanksDueDate = d.thanksDueDate
      }
      return next
    })
  }

  const toggleCourse = (id: string) =>
    set('courseIds', form.courseIds.includes(id) ? form.courseIds.filter(c => c !== id) : [...form.courseIds, id])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input = { ...form, startsAt: localToIso(form.date, form.time) }
    const invalid = validateEventInput(input)
    if (invalid) { setError(invalid); return }
    setSaving(true)
    setError(null)
    const res = await saveCuttingEdgeEvent(eventId, input)
    if (!res.ok) { setSaving(false); setError(res.error); return }
    // Stay in the saving state until the event page replaces this one.
    router.push(withFrom(`/instructor/cutting-edge-talks/${res.id}`, from))
    router.refresh()
  }

  if (saving) {
    return (
      <div role="status" className="bg-surface rounded-2xl border border-border p-10 flex flex-col items-center gap-3 text-muted-text">
        <span className="h-8 w-8 rounded-full border-2 border-border border-t-teal-primary animate-spin" aria-hidden="true" />
        <p className="text-sm font-semibold">Saving {form.title || 'event'}…</p>
      </div>
    )
  }

  const padletNote = (url: string) => !url.trim() && (
    <p className="badge-amber border rounded-lg px-3 py-2 text-xs mt-2">
      Add this talk&apos;s Padlet link — every speaker has their own. You can save without it and add it later.
    </p>
  )

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <section className="bg-surface rounded-2xl border border-border p-6 flex flex-col gap-4">
        <h2 className="text-lg font-bold text-dark-text">Event</h2>
        <p className="text-xs text-muted-text"><span className="text-red-600">*</span> Required</p>
        <Field label="Title" required>
          <input className={`${inputCls} mt-1`} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Breaking Into Engineering & Security" required />
        </Field>
        <Field label="Speaker" required>
          <input className={`${inputCls} mt-1`} value={form.speaker} onChange={e => set('speaker', e.target.value)} placeholder="Shawna Faulkner" required />
        </Field>
        <div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Date" required>
              <input type="date" className={`${inputCls} mt-1`} value={form.date} onChange={e => setDate(e.target.value)} required />
            </Field>
            <Field label="Start time" required>
              <input type="time" className={`${inputCls} mt-1`} value={form.time} onChange={e => set('time', e.target.value)} required />
            </Field>
            <Field label="Block">
              <select className={`${inputCls} mt-1`} value={form.block} onChange={e => set('block', e.target.value as EventInput['block'])}>
                <option value="">None</option>
                {BLOCKS.map(b => <option key={b} value={b}>Block {b}</option>)}
              </select>
            </Field>
          </div>
          <p className="text-xs text-muted-text mt-1">
            Enter the time in your timezone ({timeZone}). Everyone sees it converted to their own local time.
          </p>
        </div>
        <Field label="Where" hint="Usually the Focus Friday link." required>
          <input className={`${inputCls} mt-1`} value={form.locationText} onChange={e => set('locationText', e.target.value)} placeholder="Focus Friday Zoom" required />
        </Field>
        <Field label="Link (optional)">
          <input type="url" className={`${inputCls} mt-1`} value={form.locationUrl} onChange={e => set('locationUrl', e.target.value)} placeholder="https://zoom.us/j/…" />
        </Field>
        <div>
          <p className={labelCls}>About</p>
          <RichTextEditor content={form.aboutHtml} onChange={html => set('aboutHtml', html)} minHeight={140} ariaLabel="About this talk" />
        </div>
      </section>

      <section className="bg-surface rounded-2xl border border-border p-6 flex flex-col gap-3">
        <h2 className="text-lg font-bold text-dark-text">Who it&apos;s for</h2>
        <label className="flex items-center gap-2 text-sm text-dark-text">
          <input type="radio" checked={form.audienceAll} onChange={() => set('audienceAll', true)} />
          Everyone — all students in classes running at the time
        </label>
        <label className="flex items-center gap-2 text-sm text-dark-text">
          <input type="radio" checked={!form.audienceAll} onChange={() => set('audienceAll', false)} />
          Only specific classes
        </label>
        {!form.audienceAll && (
          <div className="ml-6 flex flex-col gap-1.5">
            {courses.length === 0 && <p className="text-sm text-muted-text">No current or upcoming classes.</p>}
            {courses.map(c => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-dark-text">
                <input type="checkbox" checked={form.courseIds.includes(c.id)} onChange={() => toggleCourse(c.id)} />
                {c.name}
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="bg-surface rounded-2xl border border-border p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-dark-text">{QUESTION_TITLE}</h2>
          <p className="text-xs text-muted-text mt-1">Required for students who RSVP yes. They check a box once they&apos;ve posted.</p>
        </div>
        <Field label="Padlet link">
          <input type="url" className={`${inputCls} mt-1`} value={form.questionPadletUrl} onChange={e => set('questionPadletUrl', e.target.value)} placeholder="https://padlet.com/…" />
        </Field>
        {padletNote(form.questionPadletUrl)}
        <Field label="Due date" hint="Defaults to 7 days before the talk." required>
          <input type="date" className={`${inputCls} mt-1`} value={form.questionDueDate} onChange={e => { setDueTouched(true); set('questionDueDate', e.target.value) }} required />
        </Field>
        <div>
          <p className={labelCls}>Instructions</p>
          <RichTextEditor content={form.questionHtml} onChange={html => set('questionHtml', html)} minHeight={160} ariaLabel="Question instructions" />
        </div>
      </section>

      <section className="bg-surface rounded-2xl border border-border p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold text-dark-text">{THANKS_TITLE}</h2>
          <p className="text-xs text-muted-text mt-1">Required after the talk for students who RSVP&apos;d yes. They can check &ldquo;I did not make it&rdquo; instead.</p>
        </div>
        <Field label="Padlet link">
          <input type="url" className={`${inputCls} mt-1`} value={form.thanksPadletUrl} onChange={e => set('thanksPadletUrl', e.target.value)} placeholder="https://padlet.com/…" />
        </Field>
        {padletNote(form.thanksPadletUrl)}
        <Field label="Due date" hint="Defaults to 7 days after the talk." required>
          <input type="date" className={`${inputCls} mt-1`} value={form.thanksDueDate} onChange={e => { setDueTouched(true); set('thanksDueDate', e.target.value) }} required />
        </Field>
        <div>
          <p className={labelCls}>Instructions</p>
          <RichTextEditor content={form.thanksHtml} onChange={html => set('thanksHtml', html)} minHeight={140} ariaLabel="Thank-you instructions" />
        </div>
      </section>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity">
          {saving ? 'Saving…' : eventId ? 'Save changes' : 'Save as draft'}
        </button>
        <button type="button" onClick={() => router.back()} className="text-sm text-muted-text hover:text-dark-text">Cancel</button>
      </div>
    </form>
  )
}
