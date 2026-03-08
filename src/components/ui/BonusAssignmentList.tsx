'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type BonusAssignment = {
  id: string
  title: string
  due_date: string | null
  published: boolean
  skill_tags: string[] | null
  moduleTitle: string | null
}

export default function BonusAssignmentList({
  assignments,
  courseId,
}: {
  assignments: BonusAssignment[]
  courseId: string
}) {
  const supabase = createClient()
  const [items, setItems] = useState(assignments)

  const togglePublished = async (id: string, current: boolean) => {
    setItems(prev => prev.map(a => a.id === id ? { ...a, published: !current } : a))
    const { error } = await supabase.from('assignments').update({ published: !current }).eq('id', id)
    if (error) setItems(prev => prev.map(a => a.id === id ? { ...a, published: current } : a))
  }

  return (
    <div className="mt-10">
      <h3 className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-4">
        Bonus Assignments <span className="normal-case font-normal">(from other modules)</span>
      </h3>
      <div className="flex flex-col gap-3">
        {items.map(a => (
          <div key={a.id} className="bg-surface rounded-xl border border-border px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-medium text-dark-text">{a.title}</p>
                  <span className="text-xs font-medium bg-purple-light text-purple-primary border border-purple-primary/30 rounded-full px-2 py-0.5">Bonus</span>
                  <button
                    type="button"
                    onClick={() => togglePublished(a.id, a.published)}
                    className={`text-xs font-medium rounded-full px-2 py-0.5 border transition-colors ${
                      a.published
                        ? 'bg-teal-light text-teal-primary border-teal-primary/30 hover:bg-red-50 hover:text-red-500 hover:border-red-300'
                        : 'bg-background text-muted-text border-border hover:bg-teal-light hover:text-teal-primary hover:border-teal-primary/30'
                    }`}
                  >
                    {a.published ? 'Published' : 'Draft'}
                  </button>
                </div>
                {(a.skill_tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(a.skill_tags ?? []).map(tag => (
                      <span key={tag} className="text-xs bg-teal-light text-teal-primary border border-teal-primary/30 rounded-full px-2 py-0.5">{tag}</span>
                    ))}
                  </div>
                )}
                {a.moduleTitle && (
                  <p className="text-xs text-muted-text mt-1.5">From: {a.moduleTitle}</p>
                )}
                {a.due_date && (
                  <p className="text-xs text-muted-text mt-0.5">
                    Due {new Date(a.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
              <Link
                href={`/instructor/courses/${courseId}/assignments/${a.id}`}
                className="text-xs text-teal-primary font-medium hover:underline shrink-0"
              >
                Edit →
              </Link>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-text mt-3">
        Students see published bonus assignments in Level Up Your Skills.
      </p>
    </div>
  )
}
