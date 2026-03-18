'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveAnswerKey } from '@/lib/grade-actions'
import { normalizeUrl } from '@/lib/url'

interface Props {
  assignmentId: string
  courseId: string
  initialUrl: string | null
}

const KeyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
)

const ExternalIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

export default function AnswerKeyField({ assignmentId, courseId, initialUrl }: Props) {
  const router = useRouter()
  const [url, setUrl] = useState(initialUrl ?? '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    const result = await saveAnswerKey(assignmentId, draft.trim() || null, courseId)
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setUrl(draft.trim())
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1 mt-4">
      {error && <p className="text-xs text-red-500 px-1">{error}</p>}
      <div className="flex items-center gap-2 p-3 badge-amber border rounded-xl">
        <KeyIcon />
        <input
          autoFocus
          type="url"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(url); setEditing(false) } }}
          placeholder="https://…"
          className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-dark-text placeholder:text-muted-text min-w-0 focus:outline-none focus:ring-2 focus:ring-teal-primary"
        />
        <button
          onClick={save}
          disabled={saving}
          className="text-sm px-4 py-1.5 bg-teal-primary text-white rounded-lg font-semibold disabled:opacity-50 shrink-0 hover:opacity-90 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() => { setDraft(url); setEditing(false) }}
          className="text-sm text-muted-text hover:text-dark-text shrink-0"
        >
          Cancel
        </button>
      </div>
      </div>
    )
  }

  if (url) {
    return (
      <div className="flex items-center gap-3 mt-4 px-4 py-3 badge-amber border rounded-xl">
        <span className="shrink-0"><KeyIcon /></span>
        <a
          href={normalizeUrl(url)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-sm font-semibold hover:underline flex items-center gap-1.5 min-w-0"
        >
          <span>Answer Key</span>
          <ExternalIcon />
        </a>
        <button
          onClick={() => { setDraft(url); setEditing(true) }}
          className="text-xs font-medium shrink-0 hover:opacity-70 transition-opacity"
        >
          Edit
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed badge-amber hover:opacity-80 transition-opacity text-xs font-semibold"
    >
      <KeyIcon />
      Add answer key
    </button>
  )
}
