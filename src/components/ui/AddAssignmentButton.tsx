'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const SKIP_DAYS = new Set(['Assignments', 'Resources', 'Wiki', 'Links'])

type Day = { id: string; day_name: string; order: number }
type Module = { id: string; title: string; order: number; week_number: number | null; module_days: Day[] }

interface Props {
  courseId: string
  className?: string
}

export default function AddAssignmentButton({ courseId, className }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [modules, setModules] = useState<Module[]>([])
  const [moduleId, setModuleId] = useState('')
  const [dayId, setDayId] = useState('')
  const [creating, setCreating] = useState(false)

  const days = modules.find(m => m.id === moduleId)?.module_days
    .filter(d => !SKIP_DAYS.has(d.day_name))
    .sort((a, b) => a.order - b.order) ?? []

  const handleOpen = async () => {
    const { data } = await supabase
      .from('modules')
      .select('id, title, order, week_number, module_days(id, day_name, order)')
      .eq('course_id', courseId)
      .order('order', { ascending: true })
    const mods = (data ?? []).filter((m: Module) => m.title && !m.title.includes('DO NOT PUBLISH'))
    setModules(mods)
    setModuleId(mods[0]?.id ?? '')
    setDayId('')
    setOpen(true)
  }

  const handleCreate = async () => {
    if (!dayId) return
    setCreating(true)
    const existingCount = days.length
    const { data, error } = await supabase
      .from('assignments')
      .insert({ module_day_id: dayId, title: 'New Assignment', published: false, order: existingCount })
      .select('id')
      .single()
    setCreating(false)
    if (error || !data) { alert(error?.message ?? 'Failed to create'); return }
    setOpen(false)
    router.push(`/instructor/courses/${courseId}/assignments/${data.id}`)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`text-xs font-semibold bg-purple-primary text-white rounded-full px-3 py-1.5 hover:opacity-90 transition-opacity ${className ?? ''}`}
      >
        + Add Assignment
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
            <div
              className="bg-surface rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-dark-text">New Assignment</h2>
                <button onClick={() => setOpen(false)} className="text-muted-text hover:text-dark-text text-xl leading-none">✕</button>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Module</label>
                  <select
                    value={moduleId}
                    onChange={e => { setModuleId(e.target.value); setDayId('') }}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-purple-primary"
                  >
                    {modules.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.week_number ? `Week ${m.week_number}: ` : ''}{m.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Day</label>
                  <select
                    value={dayId}
                    onChange={e => setDayId(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-purple-primary"
                  >
                    <option value="">— Select day —</option>
                    {days.map(d => (
                      <option key={d.id} value={d.id}>{d.day_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button onClick={() => setOpen(false)} className="text-sm text-muted-text hover:text-dark-text">Cancel</button>
                <button
                  onClick={handleCreate}
                  disabled={!dayId || creating}
                  className="text-sm font-semibold bg-purple-primary text-white px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {creating ? 'Creating…' : 'Create & Edit →'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
