'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Task = { id: string; label: string; order: number; linkText?: string }

const DEFAULT_TASKS: Task[] = [
  { id: 'zoom-link',       label: 'Zoom Link',            order: 0, linkText: 'Zoom Link' },
  { id: 'slack-link',      label: 'Slack Link',           order: 1, linkText: 'Slack Link' },
  { id: 'zoom-recordings', label: 'Zoom Recordings Link', order: 2, linkText: 'Zoom Recordings' },
  { id: 'office-hours',    label: 'Office Hours Link',    order: 3, linkText: 'Book an Office Hours appointment' },
]

export default function LaunchSetupView({ content }: { content: string | null }) {
  const [tasks, setTasks] = useState<Task[]>(DEFAULT_TASKS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    createClient()
      .from('global_content').select('content').eq('slug', 'launch-tasks').single()
      .then(({ data }) => {
        if (cancelled) return
        if (data?.content) {
          try {
            const parsed = JSON.parse(data.content)
            setTasks(Array.isArray(parsed) ? parsed : (parsed.tasks ?? DEFAULT_TASKS))
          } catch { /* keep defaults */ }
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading) return <p className="text-sm text-muted-text">Loading…</p>

  let values: Record<string, string> = {}
  let extraTasks: Task[] = []
  try {
    const parsed = JSON.parse(content ?? '{}')
    values = parsed.values ?? {}
    extraTasks = parsed.extraTasks ?? []
  } catch { /* leave empty */ }

  const filled = [...tasks, ...extraTasks]
    .sort((a, b) => a.order - b.order)
    .filter(t => values[t.id])

  if (filled.length === 0) return <p className="text-sm text-muted-text italic">No links added yet.</p>

  return (
    <ul className="flex flex-col gap-2">
      {filled.map(t => (
        <li key={t.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold text-dark-text shrink-0">{t.label}:</span>
          <a
            href={values[t.id]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-primary underline break-all"
          >
            {values[t.id]}
          </a>
        </li>
      ))}
    </ul>
  )
}
