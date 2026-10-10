'use client'
import { useRef, useState } from 'react'
import { LEVEL_UP_PLATFORMS, type LevelUpPlatform } from '@/lib/level-up-platforms'
import LevelUpCards from './LevelUpCards'
import type { LevelUpLink } from '@/lib/level-up-links'
import {
  createLevelUpLink,
  updateLevelUpLink,
  deleteLevelUpLink,
  moveLevelUpLink,
  listLevelUpLinksForEditor,
} from '@/lib/level-up-actions'

type Draft = { title: string; url: string; description: string; shared: boolean }

const INPUT = 'w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary'
const SMALL_BTN = 'text-xs text-muted-text hover:text-teal-primary disabled:opacity-30 disabled:hover:text-muted-text'
const CHIP = 'text-[11px] font-medium rounded-full px-1.5 py-px border'

function LinkForm({ initial, submitLabel, onSubmit, onCancel, canChooseScope }: {
  initial: Draft
  submitLabel: string
  onSubmit: (draft: Draft) => Promise<string | null>
  onCancel: () => void
  /** Only when adding, and only for someone who may edit shared links */
  canChooseScope?: boolean
}) {
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const err = await onSubmit(draft)
    setSaving(false)
    if (err) setError(err)
  }

  return (
    <form onSubmit={submit} className="bg-background rounded-lg border border-border p-3 flex flex-col gap-2">
      <input value={draft.title} onChange={e => set({ title: e.target.value })} placeholder="Course title, e.g. Learn JavaScript" aria-label="Title" className={INPUT} />
      <input value={draft.url} onChange={e => set({ url: e.target.value })} placeholder="https://…" aria-label="Link" inputMode="url" className={INPUT} />
      <input value={draft.description} onChange={e => set({ description: e.target.value })} placeholder="Short note for students (optional)" aria-label="Description" className={INPUT} />
      {canChooseScope && (
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dark-text">
          <legend className="sr-only">Show in</legend>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={!draft.shared} onChange={() => set({ shared: false })} /> Only this course
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={draft.shared} onChange={() => set({ shared: true })} /> Every course
          </label>
        </fieldset>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="submit" disabled={saving || !draft.title.trim() || !draft.url.trim()}
          className="px-3 py-1.5 text-sm font-semibold bg-teal-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50">
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-muted-text hover:text-dark-text">Cancel</button>
        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
      </div>
    </form>
  )
}

function LinkRow({ link, canEdit, isFirst, isLast, onChange, courseId }: {
  link: LevelUpLink
  canEdit: boolean
  isFirst: boolean
  isLast: boolean
  courseId: string
  onChange: (action: () => Promise<{ error?: string }>) => Promise<string | null>
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const shared = link.course_id === null

  if (editing) {
    return (
      <li>
        <LinkForm
          initial={{ title: link.title, url: link.url, description: link.description ?? '', shared }}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSubmit={async d => {
            const err = await onChange(() => updateLevelUpLink(link.id, courseId, { title: d.title, url: d.url, description: d.description }))
            if (!err) setEditing(false)
            return err
          }}
        />
      </li>
    )
  }

  return (
    <li className={`pb-3 border-b border-border last:border-b-0 last:pb-0 ${link.published ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-primary hover:underline break-words">
          {link.title} ↗<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <span className={`${CHIP} ${shared ? 'border-border text-muted-text' : 'border-purple-primary/30 bg-purple-light text-purple-primary'}`}>
          {shared ? 'Every course' : 'This course'}
        </span>
        {!link.published && <span className={`${CHIP} border-border text-muted-text`}>Hidden from students</span>}
      </div>
      {link.description && <p className="text-sm text-muted-text mt-0.5">{link.description}</p>}
      {canEdit && (
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <button type="button" className={SMALL_BTN} disabled={isFirst} aria-label={`Move ${link.title} up`} onClick={() => onChange(() => moveLevelUpLink(link.id, courseId, 'up'))}>↑</button>
          <button type="button" className={SMALL_BTN} disabled={isLast} aria-label={`Move ${link.title} down`} onClick={() => onChange(() => moveLevelUpLink(link.id, courseId, 'down'))}>↓</button>
          <button type="button" className={SMALL_BTN} onClick={() => onChange(() => updateLevelUpLink(link.id, courseId, { published: !link.published }))}>
            {link.published ? 'Hide' : 'Show'}
          </button>
          <button type="button" className={SMALL_BTN} onClick={() => setEditing(true)}>Edit</button>
          {confirmDelete ? (
            <>
              <button type="button" className="text-xs font-semibold text-red-500 hover:underline" onClick={() => onChange(() => deleteLevelUpLink(link.id, courseId))}>Delete</button>
              <button type="button" className={SMALL_BTN} onClick={() => setConfirmDelete(false)}>Keep</button>
            </>
          ) : (
            <button type="button" className="text-xs text-muted-text hover:text-red-500" onClick={() => setConfirmDelete(true)}>Delete</button>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * The recommended courses on one platform card. The card shows the same "N recommended courses" button students
 * get (so it looks and sizes like theirs), but it opens an editor instead of the plain list.
 */
function PlatformLinks({ platform, links, canEditShared, courseId, refresh }: {
  platform: LevelUpPlatform
  links: LevelUpLink[]
  canEditShared: boolean
  courseId: string
  refresh: () => Promise<void>
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const visible = links.filter(l => l.published).length
  const hidden = links.length - visible
  const name = LEVEL_UP_PLATFORMS[platform].name
  const titleId = `edit-recommended-${platform}`
  const close = () => { dialogRef.current?.close(); setAdding(false); setError(null) }

  // Runs one mutation, then reloads the list; returns an error message for inline display
  const onChange = async (action: () => Promise<{ error?: string }>) => {
    setError(null)
    const result = await action()
    if (result.error) { setError(result.error); return result.error }
    await refresh()
    return null
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
        className="self-start text-sm font-semibold text-dark-text hover:text-teal-primary underline decoration-dotted underline-offset-4"
      >
        {links.length === 0
          ? '+ Add recommended courses'
          : `${visible} recommended course${visible === 1 ? '' : 's'}${hidden ? ` (+${hidden} hidden)` : ''} · Edit`}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => { setAdding(false); setError(null) }}
        // A click on the backdrop lands on the <dialog> itself, not its content
        onClick={e => { if (e.target === e.currentTarget) close() }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-border bg-surface text-dark-text p-0 backdrop:bg-black/60"
      >
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <h3 id={titleId} className="font-semibold text-dark-text">Recommended on {name}</h3>
            <button type="button" onClick={close} aria-label="Close" className="text-muted-text hover:text-dark-text text-lg leading-none -mt-1">
              ✕
            </button>
          </div>

          {links.length === 0 && !adding && <p className="text-sm text-muted-text">No recommended courses yet.</p>}
          {links.length > 0 && (
            <ul className="flex flex-col gap-3">
              {links.map(l => {
                // ↑/↓ reorder within the link's own scope (every course, or this course)
                const scope = links.filter(o => (o.course_id === null) === (l.course_id === null))
                const i = scope.indexOf(l)
                return (
                  <LinkRow key={l.id} link={l} canEdit={l.course_id !== null || canEditShared}
                    isFirst={i === 0} isLast={i === scope.length - 1} courseId={courseId} onChange={onChange} />
                )
              })}
            </ul>
          )}
          {error && <p role="alert" className="text-xs text-red-500">{error}</p>}

          {adding ? (
            <LinkForm
              initial={{ title: '', url: '', description: '', shared: false }}
              submitLabel="Add course"
              canChooseScope={canEditShared}
              onCancel={() => setAdding(false)}
              onSubmit={async d => {
                const result = await createLevelUpLink({ courseId, platform, shared: d.shared, title: d.title, url: d.url, description: d.description })
                if (result.error) return result.error
                await refresh()
                setAdding(false)
                return null
              }}
            />
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="self-start text-sm text-teal-primary hover:underline">
              + Add a course
            </button>
          )}
        </div>
      </dialog>
    </>
  )
}

/**
 * Staff view of the top of Level Up Your Skills: the same cards students see, with each platform's
 * recommended courses editable from its card's pop-up. Links are either shared with every course or this course's own.
 */
export default function LevelUpLinksEditor({ courseId, initialLinks, canEditShared }: {
  courseId: string
  initialLinks: LevelUpLink[]
  canEditShared: boolean
}) {
  const [links, setLinks] = useState(initialLinks)

  const refresh = async () => {
    const result = await listLevelUpLinksForEditor(courseId)
    if (result.error === undefined) setLinks(result.links)
  }

  return (
    <LevelUpCards
      courseId={courseId}
      links={links}
      instructor
      renderLinks={(platform, platformLinks) => (
        <PlatformLinks platform={platform} links={platformLinks} canEditShared={canEditShared} courseId={courseId} refresh={refresh} />
      )}
    />
  )
}
