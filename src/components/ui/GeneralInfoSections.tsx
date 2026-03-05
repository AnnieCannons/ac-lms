'use client'
import { useState } from 'react'
import HtmlContent from './HtmlContent'
import DailySchedule from './DailySchedule'
import { CourseOutlineView } from './GeneralInfoEditor'
import YearlyScheduleSection from './YearlyScheduleSection'
import GlobalContentSection from './GlobalContentSection'

const HTML_CLASSES = `text-sm text-dark-text leading-relaxed
  [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h1:first-child]:mt-0
  [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
  [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
  [&_p]:mb-2 [&_p:last-child]:mb-0
  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5
  [&_a]:text-teal-primary [&_a]:underline [&_strong]:font-semibold
  [&_table]:w-full [&_table]:border-collapse [&_table]:mb-3
  [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-muted-text [&_th]:uppercase [&_th]:tracking-wide [&_th]:py-2 [&_th]:px-3 [&_th]:border-b [&_th]:border-border
  [&_td]:py-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-border [&_td]:align-top`

interface Section {
  id: string
  title: string
  content: string | null
  type: string | null
  order: number
}

export default function GeneralInfoSections({ sections }: { sections: Section[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (id: string) => setCollapsed(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  return (
    <div className="flex flex-col gap-4">
      {sections.length > 1 && (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setCollapsed(new Set())} className="text-xs text-muted-text hover:text-dark-text transition-colors">Expand all</button>
          <span className="text-xs text-border">·</span>
          <button type="button" onClick={() => setCollapsed(new Set(sections.map(s => s.id)))} className="text-xs text-muted-text hover:text-dark-text transition-colors">Collapse all</button>
        </div>
      )}
      {sections.map(section => (
        <div key={section.id} className="bg-surface rounded-2xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => toggle(section.id)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-border/10 transition-colors"
          >
            <h2 className="font-semibold text-dark-text">{section.title}</h2>
            <span className={`text-xs text-muted-text transition-transform duration-150 ${collapsed.has(section.id) ? '' : 'rotate-180'}`}>▾</span>
          </button>
          {!collapsed.has(section.id) && (
            <div className="px-6 pb-6">
              {section.type === 'daily_schedule' && <DailySchedule />}
              {section.type === 'course_outline' && <CourseOutlineView content={section.content} />}
              {section.type === 'yearly_schedule' && <YearlyScheduleSection />}
              {section.type === 'computer_wifi' && <GlobalContentSection slug="computer-wifi" />}
              {section.type === 'policies_procedures' && <GlobalContentSection slug="policies" />}
              {section.type?.startsWith('global:') && <GlobalContentSection slug={section.type.slice(7)} />}
              {(section.type === 'text' || !section.type) && (
                section.content
                  ? <HtmlContent html={section.content} className={HTML_CLASSES} />
                  : <p className="text-sm text-muted-text italic">No content yet.</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
