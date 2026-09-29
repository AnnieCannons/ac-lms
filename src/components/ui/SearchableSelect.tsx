'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

// Single-choice dropdown you can search by typing. The first option (`allLabel`) stands for "no
// filter" and is what `allValue` selects; it is the default.
export default function SearchableSelect({ label, allLabel, allValue = 'all', options, value, onChange, widthClass = 'w-52' }: {
  label: string
  allLabel: string
  allValue?: string
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  widthClass?: string
}) {
  const uid = useId()
  const inputId = `${uid}-input`
  const listId = `${uid}-list`
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  // null while the field just shows the current choice; a string once the user starts typing.
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)

  const all = useMemo<SelectOption[]>(() => [{ value: allValue, label: allLabel }, ...options], [allValue, allLabel, options])
  const selectedLabel = all.find(o => o.value === value)?.label ?? allLabel
  const filtered = useMemo(() => {
    const q = (query ?? '').trim().toLowerCase()
    return q ? all.filter(o => o.label.toLowerCase().includes(q)) : all
  }, [all, query])

  const close = () => {
    setOpen(false)
    setQuery(null)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const choose = (v: string) => {
    onChange(v)
    close()
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
      if (open && filtered[active]) choose(filtered[active].value)
      else setOpen(true)
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      close()
    }
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <label htmlFor={inputId} className="text-sm text-muted-text">
        {label}{' '}
        <span className="relative inline-block">
          <input
            id={inputId}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && filtered[active] ? `${uid}-opt-${filtered[active].value}` : undefined}
            autoComplete="off"
            // While open, the field starts empty (the current choice shows as the placeholder) so
            // typing always starts a fresh search instead of appending to the old choice.
            value={query ?? (open ? '' : selectedLabel)}
            placeholder={selectedLabel}
            onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true) }}
            onFocus={() => {
              setActive(Math.max(all.findIndex(o => o.value === value), 0))
              setOpen(true)
            }}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className={`${widthClass} rounded-lg border border-border bg-surface py-2 pl-3 pr-9 text-sm text-dark-text placeholder:text-muted-text focus:border-teal-primary focus:outline-none`}
          />
          <ChevronDown
            aria-hidden="true"
            className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </label>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 z-30 mt-1 max-h-60 w-64 overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-sm text-muted-text">No matches for &ldquo;{query}&rdquo;</li>
          ) : filtered.map((o, i) => (
            <li
              key={o.value}
              id={`${uid}-opt-${o.value}`}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(o.value)}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm text-dark-text ${i === active ? 'bg-background' : ''} ${o.value === value ? 'font-semibold' : ''}`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
