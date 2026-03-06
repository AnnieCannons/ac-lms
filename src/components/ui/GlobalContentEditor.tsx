'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import RichTextEditor from '@/components/ui/RichTextEditor'
import HtmlContent from '@/components/ui/HtmlContent'

const HTML_CLASSES = `text-sm text-dark-text leading-relaxed
  [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h1:first-child]:mt-0
  [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
  [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
  [&_p]:mb-2 [&_p:last-child]:mb-0
  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5
  [&_a]:text-teal-primary [&_a]:underline [&_strong]:font-semibold`

export default function GlobalContentEditor({ slug, title }: { slug: string; title: string }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    createClient()
      .from('global_content')
      .select('content')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        setContent(data?.content ?? '')
        setLoading(false)
      })
  }, [slug])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const { error } = await createClient()
      .from('global_content')
      .upsert({ slug, title, content })
    if (error) {
      setError(error.message)
    } else {
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  if (loading) return <p className="text-sm text-muted-text">Loading…</p>

  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-dark-text">{title}</h2>
        <div className="flex items-center gap-3">
          <span aria-live="polite" className="text-sm text-teal-primary font-medium min-w-0">{saved ? '✓ Saved' : ''}</span>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-muted-text hover:text-teal-primary transition-colors"
            >
              ✎ Edit
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-4">
          <div className="border border-border rounded-xl overflow-hidden">
            <RichTextEditor content={content} onChange={setContent} placeholder="Add content…" />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-teal-primary text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-sm text-muted-text hover:text-dark-text transition-colors"
            >
              Cancel
            </button>
          </div>
          <p role="alert" aria-live="assertive" className="text-xs text-red-500 min-h-[1rem]">{error}</p>
        </div>
      ) : content ? (
        <HtmlContent html={content} className={HTML_CLASSES} />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-muted-text hover:text-teal-primary italic transition-colors"
        >
          + Add content
        </button>
      )}
    </div>
  )
}
