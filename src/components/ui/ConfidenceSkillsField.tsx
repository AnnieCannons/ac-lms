'use client'

import { useState, useEffect, useRef } from 'react'
import { normalizeSkillName } from '@/lib/skill-normalize'
import { listSkills, createSkill, renameSkill, type ConfidenceSkill } from '@/lib/skill-actions'

interface Props {
  value: ConfidenceSkill[]
  onChange: (skills: ConfidenceSkill[]) => void
}

function EditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

export default function ConfidenceSkillsField({ value, onChange }: Props) {
  const [allSkills, setAllSkills] = useState<ConfidenceSkill[]>([])
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameInput, setRenameInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listSkills().then(({ error, skills }) => {
      if (error) { alert(error); return }
      setAllSkills(skills)
    })
  }, [])

  const selectedIds = new Set(value.map(s => s.id))
  const normalizedInput = normalizeSkillName(input)
  const filtered = allSkills
    .filter(s => !selectedIds.has(s.id))
    .filter(s => !normalizedInput || normalizeSkillName(s.name).includes(normalizedInput))

  const exactMatch = allSkills.some(s => normalizeSkillName(s.name) === normalizedInput)

  function openDropdown() {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 })
    }
    setOpen(true)
    setHighlightedIndex(0)
  }

  function selectSkill(skill: ConfidenceSkill) {
    onChange([...value, skill])
    setInput('')
    setOpen(false)
  }

  async function createAndSelect(name: string) {
    if (!name.trim() || busy) return
    setBusy(true)
    const { error, skill } = await createSkill(name)
    setBusy(false)
    if (error) { alert(error); return }
    if (skill) {
      setAllSkills(prev => prev.some(s => s.id === skill.id) ? prev : [...prev, skill])
      selectSkill(skill)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      openDropdown()
      setHighlightedIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && filtered.length > 0 && highlightedIndex < filtered.length) {
        selectSkill(filtered[highlightedIndex])
      } else if (input.trim() && !exactMatch) {
        createAndSelect(input)
      } else if (input.trim() && exactMatch) {
        const match = allSkills.find(s => normalizeSkillName(s.name) === normalizedInput)
        if (match) selectSkill(match)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function handleBlur(e: React.FocusEvent) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) setOpen(false)
  }

  function removeTag(skillId: string) {
    onChange(value.filter(s => s.id !== skillId))
  }

  function startRename(skill: ConfidenceSkill) {
    setRenamingId(skill.id)
    setRenameInput(skill.name)
  }

  async function commitRename() {
    if (!renamingId || !renameInput.trim() || busy) { setRenamingId(null); return }
    setBusy(true)
    const { error } = await renameSkill(renamingId, renameInput)
    setBusy(false)
    if (error) { alert(error); return }
    const updated = renameInput.trim()
    setAllSkills(prev => prev.map(s => s.id === renamingId ? { ...s, name: updated } : s))
    onChange(value.map(s => s.id === renamingId ? { ...s, name: updated } : s))
    setRenamingId(null)
  }

  return (
    <div ref={containerRef} onBlur={handleBlur}>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map(skill => (
          <span key={skill.id} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-teal-primary text-white">
            {renamingId === skill.id ? (
              <input
                autoFocus
                value={renameInput}
                onChange={e => setRenameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                onBlur={commitRename}
                className="bg-transparent border-b border-white/60 focus:outline-none w-24"
              />
            ) : (
              <>
                {skill.name}
                <button type="button" onClick={() => startRename(skill)} aria-label={`Rename ${skill.name}`} className="hover:opacity-70">
                  <EditIcon />
                </button>
                <button type="button" onClick={() => removeTag(skill.id)} aria-label={`Remove ${skill.name}`} className="hover:opacity-70">✕</button>
              </>
            )}
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => { setInput(e.target.value); openDropdown() }}
        onFocus={openDropdown}
        onKeyDown={handleKeyDown}
        placeholder="Type to search or create a skill…"
        autoComplete="off"
        disabled={busy}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary disabled:opacity-50"
      />
      {(open || renamingId) && (filtered.length > 0 || (input.trim() && !exactMatch)) && (
        <ul style={dropdownStyle} className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
          {filtered.map((skill, i) => (
            <li
              key={skill.id}
              onMouseDown={renamingId === skill.id ? undefined : () => selectSkill(skill)}
              className={`flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer ${i === highlightedIndex && renamingId !== skill.id ? 'bg-teal-light text-teal-primary' : 'text-dark-text hover:bg-border/30'}`}
            >
              {renamingId === skill.id ? (
                <input
                  autoFocus
                  value={renameInput}
                  onChange={e => setRenameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                  onBlur={commitRename}
                  onMouseDown={e => e.stopPropagation()}
                  className="flex-1 bg-transparent border-b border-border focus:outline-none"
                />
              ) : (
                <>
                  <span className="flex-1">{skill.name}</span>
                  <button
                    type="button"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => startRename(skill)}
                    aria-label={`Rename ${skill.name}`}
                    className="shrink-0 text-muted-text hover:text-teal-primary"
                  >
                    <EditIcon />
                  </button>
                </>
              )}
            </li>
          ))}
          {input.trim() && !exactMatch && (
            <li
              onMouseDown={() => createAndSelect(input)}
              className="px-3 py-2 text-sm cursor-pointer text-teal-primary border-t border-border hover:bg-teal-light"
            >
              + Create &quot;{input.trim()}&quot;
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
