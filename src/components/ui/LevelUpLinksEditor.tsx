'use client'
import { useState } from 'react'
import { LEVEL_UP_PLATFORMS, LEVEL_UP_PLATFORM_IDS, type LevelUpPlatform } from '@/lib/level-up-platforms'
import type { LevelUpLink } from '@/lib/level-up-links'
import {
  createLevelUpLink,
  updateLevelUpLink,
  deleteLevelUpLink,
  moveLevelUpLink,
  listLevelUpLinksForEditor,
} from '@/lib/level-up-actions'

type Draft = { platform: LevelUpPlatform; title: string; url: string; description: string }
const EMPTY_DRAFT: Draft = { platform: 'codecademy', title: '', url: '', description: '' }

const INPUT = 'w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary'
const SMALL_BTN = 'text-xs text-muted-text hover:text-teal-primary disabled:opacity-30 disabled:hover:text-muted-text'

function LinkForm({ initial, submitLabel, onSubmit, onCancel, lockPlatform }: {
  initial: Draft
  submitLabel: string
  onSubmit: (draft: Draft) => Promise<string | null>
  onCancel?: () => void
  lockPlatform?: boolean
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
    else if (!onCancel) setDraft({ ...EMPTY_DRAFT, platform: draft.platform })
  }

  return (
    <form onSubmit={submit} className="bg-background rounded-lg border border-border p-3 flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
        <select
          value={draft.platform}
          onChange={e => set({ platform: e.target.value as LevelUpPlatform })}
          disabled={lockPlatform}
          aria-label="Platform"
          className={INPUT}
        >
          {LEVEL_UP_PLATFORM_IDS.map(p => <option key={p} value={p}>{p === 'other' ? 'Other' : LEVEL_UP_PLATFORMS[p].name}</option>)}
        </select>
        <input value={draft.title} onChange={e => set({ title: e.target.value })} placeholder="Course title, e.g. Learn JavaScript" aria-label="Title" className={INPUT} />
      </div>
      <input value={draft.url} onChange={e => set({ url: e.target.value })} placeholder="https://…" aria-label="Link" inputMode="url" className={INPUT} />
      <input value={draft.description} onChange={e => set({ description: e.target.value })} placeholder="Short note for students (optional)" aria-label="Description" className={INPUT} />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving || !draft.title.trim() || !draft.url.trim()}
          className="px-3 py-1.5 text-sm font-semibold bg-teal-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50">
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-muted-text hover:text-dark-text">Cancel</button>}
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

  if (editing) {
    return (
      <li>
        <LinkForm
          initial={{ platform: link.platform, title: link.title, url: link.url, description: link.description ?? '' }}
          submitLabel="Save"
          lockPlatform
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
    <li className={`flex items-start gap-3 px-3 py-2 rounded-lg border border-border bg-surface ${link.published ? '' : 'opacity-60'}`}>
      <div className="flex-1 min-w-0">
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-teal-primary hover:underline break-words">
          {link.title} ↗
        </a>
        {!link.published && <span className="ml-2 text-xs text-muted-text">(hidden from students)</span>}
        {link.description && <p className="text-xs text-muted-text">{link.description}</p>}
        <p className="text-xs text-muted-text truncate">{link.url}</p>
      </div>
      {canEdit && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
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

function LinkSection({ title, hint, links, canEdit, readOnlyNote, courseId, shared, onChange, refresh }: {
  title: string
  hint: string
  links: LevelUpLink[]
  canEdit: boolean
  readOnlyNote?: string
  courseId: string
  shared: boolean
  onChange: (action: () => Promise<{ error?: string }>) => Promise<string | null>
  refresh: () => Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  const platforms = LEVEL_UP_PLATFORM_IDS.filter(p => links.some(l => l.platform === p))

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-dark-text">{title}</h3>
          <p className="text-xs text-muted-text">{hint}</p>
          {!canEdit && readOnlyNote && <p className="text-xs text-muted-text italic mt-0.5">{readOnlyNote}</p>}
        </div>
        {canEdit && !adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-xs text-teal-primary hover:underline shrink-0">+ Add link</button>
        )}
      </div>

      {adding && (
        <LinkForm
          initial={EMPTY_DRAFT}
          submitLabel="Add link"
          onCancel={() => setAdding(false)}
          onSubmit={async d => {
            const result = await createLevelUpLink({ courseId, shared, ...d })
            if (result.error) return result.error
            await refresh()
            setAdding(false)
            return null
          }}
        />
      )}

      {links.length === 0 && !adding && <p className="text-sm text-muted-text">No links yet.</p>}

      {platforms.map(p => {
        const group = links.filter(l => l.platform === p)
        return (
          <div key={p}>
            <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1.5">{p === 'other' ? 'Other' : LEVEL_UP_PLATFORMS[p].name}</p>
            <ul className="flex flex-col gap-1.5">
              {group.map((l, i) => (
                <LinkRow key={l.id} link={l} canEdit={canEdit} isFirst={i === 0} isLast={i === group.length - 1} courseId={courseId} onChange={onChange} />
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}

/** Staff editor for the recommended course links on Level Up Your Skills (shared + this course's extras). */
export default function LevelUpLinksEditor({ courseId, initialLinks, canEditShared }: {
  courseId: string
  initialLinks: LevelUpLink[]
  canEditShared: boolean
}) {
  const [links, setLinks] = useState(initialLinks)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    const result = await listLevelUpLinksForEditor(courseId)
    if (result.error === undefined) setLinks(result.links)
  }

  // Runs one mutation, then reloads the list; returns an error message for inline display
  const onChange = async (action: () => Promise<{ error?: string }>) => {
    setError(null)
    const result = await action()
    if (result.error) { setError(result.error); return result.error }
    await refresh()
    return null
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-5 flex flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-dark-text">Recommended course links</h2>
        <p className="text-sm text-muted-text">
          These show on the platform cards (Udemy, Pluralsight, master.dev, Codecademy, freeCodeCamp) at the top of the student Level Up page.
        </p>
        {error && <p role="alert" className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      <LinkSection
        title="Shared with every course"
        hint="Every course's Level Up page shows these."
        readOnlyNote="Only instructors and staff can change shared links."
        links={links.filter(l => l.course_id === null)}
        canEdit={canEditShared}
        courseId={courseId}
        shared
        onChange={onChange}
        refresh={refresh}
      />
      <LinkSection
        title="Only this course"
        hint="Extras for this course, shown after the shared ones. Copied when the course is duplicated."
        links={links.filter(l => l.course_id !== null)}
        canEdit
        courseId={courseId}
        shared={false}
        onChange={onChange}
        refresh={refresh}
      />
    </div>
  )
}
