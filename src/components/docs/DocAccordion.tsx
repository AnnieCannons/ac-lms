'use client'

import { ReactNode, useState } from 'react'

export interface DocAccordionItem {
  id: string
  title: string
  content: ReactNode
}

export function DocAccordion({ items, defaultOpen = true }: { items: DocAccordionItem[]; defaultOpen?: boolean }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => (defaultOpen ? new Set() : new Set(items.map(i => i.id))))

  const toggle = (id: string) => setCollapsed(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <div className="flex flex-col gap-3 mb-6">
      {items.length > 1 && (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setCollapsed(new Set())} className="text-xs text-muted-text hover:text-dark-text transition-colors">
            Expand all
          </button>
          <span className="text-xs text-border">·</span>
          <button type="button" onClick={() => setCollapsed(new Set(items.map(i => i.id)))} className="text-xs text-muted-text hover:text-dark-text transition-colors">
            Collapse all
          </button>
        </div>
      )}
      {items.map(item => {
        const isCollapsed = collapsed.has(item.id)
        return (
          <div key={item.id} className="bg-surface rounded-2xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-expanded={!isCollapsed}
              aria-controls={`doc-accordion-${item.id}`}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-border/10 transition-colors"
            >
              <h2 className="text-base font-bold text-dark-text">{item.title}</h2>
              <span aria-hidden="true" className={`text-xs text-muted-text transition-transform duration-150 ${isCollapsed ? '' : 'rotate-180'}`}>▾</span>
            </button>
            {!isCollapsed && (
              <div id={`doc-accordion-${item.id}`} className="px-5 pb-5">
                {item.content}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
