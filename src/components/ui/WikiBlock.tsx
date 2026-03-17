'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { updateWiki, toggleWikiPublished, deleteWiki } from '@/lib/wiki-actions'

const RichTextEditor = dynamic(() => import('./RichTextEditor'), { ssr: false })

interface Wiki {
  id: string
  title: string
  content: string
  published: boolean
  order: number
}

interface Props {
  wiki: Wiki
  onUpdate: (id: string, title: string, content: string) => void
  onTogglePublished: (id: string, published: boolean) => void
  onDelete: (id: string) => void
}

export default function WikiBlock({ wiki, onUpdate, onTogglePublished, onDelete }: Props) {
  const [open, setOpen] = useState(!wiki.content) // auto-open if freshly created
  const [title, setTitle] = useState(wiki.title)
  const [content, setContent] = useState(wiki.content)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [published, setPublished] = useState(wiki.published)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef({ title, content })

  useEffect(() => {
    latestRef.current = { title, content }
  }, [title, content])

  const doSave = useCallback(async (newTitle: string, newContent: string) => {
    setSaveStatus('saving')
    const result = await updateWiki(wiki.id, { title: newTitle, content: newContent })
    if (!result.error) {
      setSaveStatus('saved')
      onUpdate(wiki.id, newTitle, newContent)
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      setSaveStatus('error')
      console.error('Failed to save wiki:', result.error)
    }
  }, [wiki.id, onUpdate])

  const scheduleSave = useCallback((newTitle: string, newContent: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveStatus('saving')
    debounceRef.current = setTimeout(() => doSave(newTitle, newContent), 800)
  }, [doSave])

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    scheduleSave(newTitle, latestRef.current.content)
  }

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    scheduleSave(latestRef.current.title, newContent)
  }

  const handleTogglePublished = async () => {
    const newPublished = !published
    setPublished(newPublished)
    const result = await toggleWikiPublished(wiki.id, newPublished)
    if (result.error) {
      setPublished(!newPublished)
      console.error('Failed to toggle wiki published:', result.error)
    } else {
      onTogglePublished(wiki.id, newPublished)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete wiki "${title}"?`)) return
    const result = await deleteWiki(wiki.id)
    if (result.error) {
      alert(result.error)
      return
    }
    onDelete(wiki.id)
  }

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Drag handle (visual only — not wired to DnD for simplicity) */}
        <span className="text-muted-text cursor-grab shrink-0 select-none" aria-hidden>⠿</span>

        {/* Title input (visible when open) or clickable title */}
        {open ? (
          <input
            type="text"
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            onClick={e => e.stopPropagation()}
            className="flex-1 min-w-0 text-sm font-medium text-dark-text bg-transparent border-b border-border focus:outline-none focus:border-teal-primary"
            placeholder="Wiki title"
          />
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex-1 min-w-0 text-left text-sm font-medium text-dark-text truncate hover:text-teal-primary transition-colors"
          >
            {title || 'Untitled Wiki'}
          </button>
        )}

        {/* Save indicator / button */}
        {saveStatus === 'saving' && <span className="text-xs text-muted-text shrink-0">Saving…</span>}
        {saveStatus === 'saved' && <span className="text-xs text-teal-primary shrink-0">Saved ✓</span>}
        {saveStatus === 'error' && <span className="text-xs text-red-400 shrink-0">Save failed</span>}
        {saveStatus === 'idle' && open && (
          <button
            type="button"
            onClick={() => {
              if (debounceRef.current) clearTimeout(debounceRef.current)
              doSave(title, content)
            }}
            className="text-xs text-teal-primary hover:underline shrink-0"
          >
            Save
          </button>
        )}

        {/* Publish toggle */}
        <button
          type="button"
          onClick={handleTogglePublished}
          className={`text-xs shrink-0 font-medium px-2 py-0.5 rounded-full border transition-colors ${
            published
              ? 'border-teal-primary text-teal-primary hover:bg-teal-primary hover:text-white'
              : 'border-border text-muted-text hover:border-teal-primary hover:text-teal-primary'
          }`}
          aria-label={published ? 'Published — click to unpublish' : 'Draft — click to publish'}
        >
          {published ? 'Published' : 'Draft'}
        </button>

        {/* Chevron expand/collapse */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="text-muted-text hover:text-dark-text shrink-0 transition-colors"
          aria-label={open ? 'Collapse wiki' : 'Expand wiki'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`w-4 h-4 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={handleDelete}
          className="text-muted-text hover:text-red-400 shrink-0 transition-colors"
          aria-label="Delete wiki"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
        </button>
      </div>

      {/* Editor */}
      {open && (
        <div className="border-t border-border px-3 py-3">
          <RichTextEditor
            content={content}
            onChange={handleContentChange}
            placeholder="Write wiki content…"
          />
        </div>
      )}
    </div>
  )
}
