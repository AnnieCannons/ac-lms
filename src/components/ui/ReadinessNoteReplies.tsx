'use client'

import { useId, useState } from 'react'
import {
  addReadinessNoteReply,
  updateReadinessNoteReply,
  deleteReadinessNoteReply,
  type ReadinessNote,
  type ReadinessNoteReply,
} from '@/lib/readiness-notes-actions'
import { formatCompactDate } from '@/components/ui/ReadinessWidgets'

function ReplyForm({ initial, submitLabel, placeholder, onSubmit, onCancel }: {
  initial: string
  submitLabel: string
  placeholder: string
  onSubmit: (body: string) => Promise<string | undefined>
  onCancel: () => void
}) {
  const fieldId = useId()
  const [body, setBody] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const err = await onSubmit(body)
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="sr-only" htmlFor={fieldId}>{submitLabel}</label>
      <textarea
        id={fieldId}
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={2}
        autoFocus
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-dark-text text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-text hover:text-dark-text">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !body.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: '#6D2B5E' }}
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function ReplyItem({ reply, audience, onChanged }: {
  reply: ReadinessNoteReply
  audience: 'student' | 'staff'
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { short, full } = formatCompactDate(reply.createdAt)
  const who = reply.mine ? 'You' : reply.authorName ?? (reply.fromStudent ? 'Student' : 'Staff')

  if (editing) {
    return (
      <li>
        <ReplyForm
          initial={reply.body}
          submitLabel="Save"
          placeholder="Write a reply…"
          onCancel={() => setEditing(false)}
          onSubmit={async body => {
            const { error } = await updateReadinessNoteReply({ id: reply.id, body })
            if (error) return error
            setEditing(false)
            onChanged()
          }}
        />
      </li>
    )
  }

  const remove = async () => {
    if (!confirm('Delete this reply?')) return
    setDeleting(true)
    const { error } = await deleteReadinessNoteReply(reply.id)
    setDeleting(false)
    if (error) { alert(error); return }
    onChanged()
  }

  return (
    <li>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-sm font-medium text-dark-text">{who}</span>
        {audience === 'staff' && reply.fromStudent && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-light text-teal-primary">Student</span>
        )}
        <span className="text-xs text-muted-text" title={full}>{short}</span>
        {(reply.canEdit || reply.canDelete) && (
          <span className="ml-auto flex items-center gap-3">
            {reply.canEdit && (
              <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-teal-primary hover:underline">
                Edit
              </button>
            )}
            {reply.canDelete && (
              <button type="button" onClick={remove} disabled={deleting} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </span>
        )}
      </div>
      <p className="text-sm text-dark-text mt-0.5 whitespace-pre-wrap break-words">{reply.body}</p>
    </li>
  )
}

/** The back-and-forth under a shared readiness note: existing replies, oldest first, then a
 * Reply button. Replies are open only while the note is shared; staff still see the thread
 * (read-only) on a note they've since unshared. */
export default function NoteReplyThread({ note, audience, onChanged }: {
  note: ReadinessNote
  audience: 'student' | 'staff'
  onChanged: () => void
}) {
  const [replying, setReplying] = useState(false)
  if (note.replies.length === 0 && !note.canReply) return null

  return (
    <div className="mt-2">
      {note.replies.length > 0 && (
        <ul className="space-y-2 border-l-2 border-border pl-3 mb-2" aria-label="Replies">
          {note.replies.map(reply => (
            <ReplyItem key={reply.id} reply={reply} audience={audience} onChanged={onChanged} />
          ))}
        </ul>
      )}
      {note.canReply ? (
        replying ? (
          <ReplyForm
            initial=""
            submitLabel="Reply"
            placeholder={audience === 'student' ? 'Write a reply to your instructor…' : 'Write a reply to the student…'}
            onCancel={() => setReplying(false)}
            onSubmit={async body => {
              const { error } = await addReadinessNoteReply({ noteId: note.id, body })
              if (error) return error
              setReplying(false)
              onChanged()
            }}
          />
        ) : (
          <button type="button" onClick={() => setReplying(true)} className="text-xs font-semibold text-teal-primary hover:underline">
            Reply
          </button>
        )
      ) : (
        <p className="text-[11px] text-muted-text">Replies are closed while this note isn’t shared with the student.</p>
      )}
    </div>
  )
}
