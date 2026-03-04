'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import RichTextEditor from '@/components/ui/RichTextEditor'
import HtmlContent from '@/components/ui/HtmlContent'

interface Props {
  courseId: string
  initialContent: string | null
}

export default function SyllabusEditor({ courseId, initialContent }: Props) {
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(initialContent ?? '')
  const [draft, setDraft] = useState(initialContent ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await supabase
      .from('courses')
      .update({ syllabus_content: draft || null })
      .eq('id', courseId)
    setContent(draft)
    setSaving(false)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleCancel = () => {
    setDraft(content)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <RichTextEditor
            content={draft}
            onChange={setDraft}
            placeholder="Add course information here — syllabus, goals, schedule, instructor bios, policies, resources…"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            className="text-sm text-muted-text hover:text-dark-text transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group relative">
      <button
        onClick={() => setEditing(true)}
        className="absolute top-4 right-4 text-xs text-muted-text hover:text-teal-primary transition-colors opacity-0 group-hover:opacity-100 z-10"
      >
        ✎ Edit
      </button>
      {saved && (
        <p className="absolute top-4 right-16 text-xs text-teal-primary font-medium">Saved ✓</p>
      )}

      {content ? (
        <div className="bg-surface rounded-2xl border border-border p-8">
          <HtmlContent
            html={content}
            className="text-sm text-dark-text leading-relaxed
              [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-dark-text [&_h1]:mt-8 [&_h1]:mb-4 [&_h1:first-child]:mt-0
              [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-dark-text [&_h2]:mt-6 [&_h2]:mb-3
              [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-dark-text [&_h3]:mt-4 [&_h3]:mb-2
              [&_p]:mb-3 [&_p]:text-dark-text
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
              [&_li]:mb-1
              [&_a]:text-teal-primary [&_a]:underline
              [&_strong]:font-semibold
              [&_table]:w-full [&_table]:border-collapse [&_table]:mb-4
              [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-muted-text [&_th]:uppercase [&_th]:tracking-wide [&_th]:py-2 [&_th]:px-3 [&_th]:border-b [&_th]:border-border
              [&_td]:py-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-border [&_td]:align-top
              [&_hr]:my-6 [&_hr]:border-border"
          />
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full bg-surface rounded-2xl border border-dashed border-border p-12 text-center hover:border-teal-primary hover:bg-teal-light/10 transition-colors"
        >
          <p className="text-muted-text text-sm mb-1">No general information yet.</p>
          <p className="text-teal-primary text-sm font-medium">+ Add content</p>
        </button>
      )}
    </div>
  )
}
