'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

export interface SkillOption {
  id: string
  name: string
}

// Searchable dropdown that lets a student tick several skills. Selected skills show as
// removable chips inside the field; the list stays open while picking so several can be
// chosen in a row.
export default function SkillMultiSelect({ label, placeholder, options, selectedIds, onChange, inlineLabel = false }: {
  label: string
  // Put the label to the left of the field (as the other filters do) instead of above it.
  inlineLabel?: boolean
  placeholder: string
  options: SkillOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const uid = useId()
  const inputId = `${uid}-input`
  const listId = `${uid}-list`
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter(o => o.name.toLowerCase().includes(q)) : options
  }, [options, query])
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const toggle = (id: string) => {
    onChange(selected.has(id) ? selectedIds.filter(s => s !== id) : [...selectedIds, id])
    // Start the next search from the full list, so several skills can be picked in a row.
    setQuery('')
    setActive(0)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActive(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && filtered[active]) toggle(filtered[active].id)
      else setOpen(true)
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Tab') {
      setOpen(false)
    } else if (e.key === 'Backspace' && query === '' && selectedIds.length > 0) {
      onChange(selectedIds.slice(0, -1))
    }
  }

  const byId = new Map(options.map(o => [o.id, o]))

  return (
    <div className={inlineLabel ? 'flex items-start gap-2' : undefined}>
      <label
        htmlFor={inputId}
        className={inlineLabel ? 'shrink-0 pt-2 text-sm text-muted-text' : 'block text-sm font-medium text-dark-text mb-1.5'}
      >
        {label}
      </label>
      <div ref={containerRef} className={inlineLabel ? 'relative min-w-0 flex-1' : 'relative'}>
        <div
          className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 focus-within:border-teal-primary focus-within:ring-2 focus-within:ring-teal-primary"
          onClick={() => { inputRef.current?.focus(); setOpen(true) }}
        >
          {selectedIds.map(id => byId.get(id)).filter((o): o is SkillOption => !!o).map(o => (
            // The whole chip is the remove button, so clicking the skill's name takes it out too, not just the ✕.
            <button
              key={o.id}
              type="button"
              aria-label={`Remove ${o.name}`}
              onClick={e => { e.stopPropagation(); toggle(o.id) }}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-teal-light px-2.5 py-0.5 text-sm text-dark-text hover:opacity-80"
            >
              {o.name}
              <span aria-hidden="true" className="text-muted-text">✕</span>
            </button>
          ))}
          <input
            ref={inputRef}
            id={inputId}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && filtered[active] ? `${uid}-opt-${filtered[active].id}` : undefined}
            autoComplete="off"
            value={query}
            placeholder={selectedIds.length === 0 ? placeholder : 'Search skills…'}
            onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-dark-text placeholder:text-placeholder-text focus:outline-none"
          />
        </div>

        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
          >
            {filtered.length === 0 ? (
              <li role="presentation" className="px-3 py-2 text-sm text-muted-text">No skills match &ldquo;{query}&rdquo;</li>
            ) : filtered.map((o, i) => {
              const on = selected.has(o.id)
              return (
                <li
                  key={o.id}
                  id={`${uid}-opt-${o.id}`}
                  role="option"
                  aria-selected={on}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => toggle(o.id)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-dark-text ${i === active ? 'bg-background' : ''}`}
                >
                  <span aria-hidden="true" className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${on ? 'bg-teal-primary border-teal-primary text-white' : 'border-border'}`}>
                    {on ? '✓' : ''}
                  </span>
                  {o.name}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
