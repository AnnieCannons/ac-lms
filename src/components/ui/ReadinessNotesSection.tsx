'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import {
  getReadinessNotes,
  addReadinessNote,
  updateReadinessNote,
  deleteReadinessNote,
  getReadinessNoteSlackOptions,
  type ReadinessNote,
  type SlackTagPerson,
} from '@/lib/readiness-notes-actions'
import type { EscalationEventRecord } from '@/lib/readiness-actions'
import { EscalationHistorySection, NoteTimelineItem } from '@/components/ui/ReadinessWidgets'
import NoteReplyThread from '@/components/ui/ReadinessNoteReplies'

function todayLocal(): string {
  // en-CA formats as YYYY-MM-DD, which is what <input type="date"> wants.
  return new Date().toLocaleDateString('en-CA')
}

type NoteInput = { noteDate: string; body: string; visibleToStudent: boolean }
type SlackChoice = { postToSlack: boolean; mentionUserIds: string[] }
type SlackOptions = { channelLabel: string | null; people: SlackTagPerson[] }

/** Optional people to @mention in the note's Slack post: search, tick, shown as removable chips. */
function SlackTagPicker({ people, selected, onChange }: {
  people: SlackTagPerson[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const label = (p: SlackTagPerson) => p.name?.trim() || p.email
  const matches = q
    ? people.filter(p => !selected.includes(p.id) && (label(p).toLowerCase().includes(q) || p.email.toLowerCase().includes(q))).slice(0, 8)
    : []
  const chosen = selected.map(id => people.find(p => p.id === id)).filter((p): p is SlackTagPerson => !!p)

  return (
    <div className="pl-6 space-y-1.5">
      {chosen.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chosen.map(p => (
            <span key={p.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-teal-light text-teal-primary font-semibold">
              @{label(p)}
              <button
                type="button"
                onClick={() => onChange(selected.filter(id => id !== p.id))}
                aria-label={`Don’t tag ${label(p)}`}
                className="hover:opacity-70"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative sm:max-w-xs">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tag people (optional)…"
          aria-label="Tag people in the Slack post (optional)"
          className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-dark-text text-xs placeholder:text-muted-text"
        />
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg max-h-48 overflow-y-auto">
            {matches.map(p => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => { onChange([...selected, p.id]); setSearch('') }}
                  className="w-full text-left px-3 py-1.5 text-xs text-dark-text hover:bg-border/30"
                >
                  {label(p)} <span className="text-muted-text">{p.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function NoteForm({ initial, submitLabel, onSubmit, onCancel, slack }: {
  initial: NoteInput
  submitLabel: string
  onSubmit: (input: NoteInput & SlackChoice) => Promise<string | undefined>
  onCancel?: () => void
  /** Offer "Post to Slack" (new notes only). */
  slack?: SlackOptions
}) {
  const fieldId = useId()
  const [noteDate, setNoteDate] = useState(initial.noteDate)
  const [body, setBody] = useState(initial.body)
  const [visibleToStudent, setVisibleToStudent] = useState(initial.visibleToStudent)
  const [postToSlack, setPostToSlack] = useState(false)
  const [mentionUserIds, setMentionUserIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const err = await onSubmit({ noteDate, body, visibleToStudent, postToSlack, mentionUserIds: postToSlack ? mentionUserIds : [] })
    setSaving(false)
    if (err) { setError(err); return }
    if (!onCancel) {
      setBody(''); setNoteDate(todayLocal()); setVisibleToStudent(false)
      setPostToSlack(false); setMentionUserIds([])
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <label className="sr-only" htmlFor={`${fieldId}-date`}>Date</label>
        <input
          id={`${fieldId}-date`}
          type="date"
          value={noteDate}
          onChange={e => setNoteDate(e.target.value)}
          required
          className="px-3 py-2 rounded-lg border border-border bg-background text-dark-text text-sm sm:w-40 shrink-0"
        />
        <label className="sr-only" htmlFor={`${fieldId}-body`}>Note</label>
        <textarea
          id={`${fieldId}-body`}
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={2}
          placeholder="Add a note…"
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-dark-text text-sm"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <label className="flex items-center gap-2 text-xs text-dark-text cursor-pointer">
          <input
            type="checkbox"
            checked={visibleToStudent}
            onChange={e => setVisibleToStudent(e.target.checked)}
            className="accent-teal-primary"
          />
          Share with student
        </label>
        {slack && (
          slack.channelLabel ? (
            <label className="flex items-center gap-2 text-xs text-dark-text cursor-pointer">
              <input
                type="checkbox"
                checked={postToSlack}
                onChange={e => setPostToSlack(e.target.checked)}
                className="accent-teal-primary"
              />
              Post to Slack ({slack.channelLabel})
            </label>
          ) : (
            <span className="text-xs text-muted-text">No readiness Slack channel is set for this course</span>
          )
        )}
        <div className="flex gap-2 ml-auto">
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-text hover:text-dark-text">
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving || !body.trim()}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: '#6D2B5E' }}
          >
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
      {slack?.channelLabel && postToSlack && (
        <SlackTagPicker people={slack.people} selected={mentionUserIds} onChange={setMentionUserIds} />
      )}
    </form>
  )
}

function EditableNoteItem({ note, isLast, onChanged }: { note: ReadinessNote; isLast: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (editing) {
    return (
      <li className={`rounded-xl border border-border bg-surface p-3 ${isLast ? '' : 'mb-4'}`}>
        <NoteForm
          initial={{ noteDate: note.noteDate, body: note.body, visibleToStudent: note.visibleToStudent }}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSubmit={async input => {
            const { error } = await updateReadinessNote({ id: note.id, ...input })
            if (error) return error
            setEditing(false)
            onChanged()
          }}
        />
      </li>
    )
  }

  const remove = async () => {
    if (!confirm('Delete this note?')) return
    setDeleting(true)
    const { error } = await deleteReadinessNote(note.id)
    setDeleting(false)
    if (error) { alert(error); return }
    onChanged()
  }

  const actions = (note.canEdit || note.canDelete) ? (
    <>
      {note.canEdit && (
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-teal-primary hover:underline">
          Edit
        </button>
      )}
      {note.canDelete && (
        <button type="button" onClick={remove} disabled={deleting} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      )}
    </>
  ) : undefined

  return (
    <NoteTimelineItem
      note={note}
      isLast={isLast}
      actions={actions}
      showSharedTag
      footer={<NoteReplyThread note={note} audience="staff" onChanged={onChanged} />}
    />
  )
}

/** Staff view of a student's readiness notes: an add-note box, then the History timeline
 * with notes placed by date among the escalation events (shown as soon as either exists).
 * Notes are staff-only unless "Share with student" is ticked; the student sees shared ones
 * in their own History (ReadinessTracker), and either side can reply under a shared note. */
export default function ReadinessNotesSection({ studentId, courseId, events }: {
  studentId: string
  courseId: string
  events: EscalationEventRecord[]
}) {
  const [notes, setNotes] = useState<ReadinessNote[]>([])
  const [loadError, setLoadError] = useState(false)
  const [slackOptions, setSlackOptions] = useState<SlackOptions | undefined>(undefined)
  const [slackWarning, setSlackWarning] = useState<string | null>(null)

  const load = useCallback(() => {
    return getReadinessNotes(studentId, courseId)
      .then(n => { setNotes(n); setLoadError(false) })
      .catch(() => setLoadError(true))
  }, [studentId, courseId])

  useEffect(() => {
    let cancelled = false
    getReadinessNotes(studentId, courseId)
      .then(n => { if (!cancelled) setNotes(n) })
      .catch(() => { if (!cancelled) setLoadError(true) })
    getReadinessNoteSlackOptions(courseId)
      .then(o => { if (!cancelled) setSlackOptions(o) })
      .catch(() => { /* no Slack option -- the note form still works */ })
    return () => { cancelled = true }
  }, [studentId, courseId])

  return (
    <>
      <div className="border-t border-border pt-3">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-xs font-semibold text-muted-text uppercase tracking-wide">Add a note</h3>
          <span className="text-[11px] text-muted-text">Staff-only unless shared</span>
        </div>
        <NoteForm
          initial={{ noteDate: todayLocal(), body: '', visibleToStudent: false }}
          submitLabel="Add note"
          slack={slackOptions}
          onSubmit={async input => {
            setSlackWarning(null)
            const { error, slackError } = await addReadinessNote({ studentId, courseId, ...input })
            if (error) return error
            if (slackError) setSlackWarning(slackError)
            await load()
          }}
        />
        {slackWarning && <p className="text-xs text-amber-700 mt-2">{slackWarning}</p>}
        {loadError && <p className="text-xs text-red-600 mt-2">Couldn’t load notes.</p>}
      </div>

      {(events.length > 0 || notes.length > 0) && (
        <div className="mt-4">
          <EscalationHistorySection
            events={events}
            notes={notes}
            renderNote={(note, isLast) => <EditableNoteItem note={note} isLast={isLast} onChanged={load} />}
          />
        </div>
      )}
    </>
  )
}
