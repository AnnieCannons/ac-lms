'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import HtmlContent from '@/components/ui/HtmlContent'

const HTML_CLASSES = `text-sm text-dark-text leading-relaxed
  [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h1:first-child]:mt-0
  [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
  [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
  [&_p]:mb-2 [&_p:last-child]:mb-0
  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5
  [&_a]:text-teal-primary [&_a]:underline [&_strong]:font-semibold`

export default function GlobalContentSection({ slug }: { slug: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient()
      .from('global_content')
      .select('content')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        setContent(data?.content ?? null)
        setLoading(false)
      })
  }, [slug])

  if (loading) return <p className="text-sm text-muted-text">Loading…</p>
  if (!content) return <p className="text-sm text-muted-text italic">No content yet.</p>
  return <HtmlContent html={content} className={HTML_CLASSES} />
}
