'use client'

import { useState } from 'react'
import Link from 'next/link'
import { archiveCourse } from '@/lib/course-actions'

interface PastCourse {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  code?: string | null
}

interface Props {
  courses: PastCourse[]
}

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function UnarchiveButton({ courseId, courseName }: { courseId: string; courseName: string }) {
  const [loading, setLoading] = useState(false)

  async function handleUnarchive() {
    setLoading(true)
    const result = await archiveCourse(courseId, false)
    if (result.error) {
      alert(result.error)
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleUnarchive}
      disabled={loading}
      className="text-xs text-muted-text hover:text-teal-primary transition-colors disabled:opacity-50"
    >
      {loading ? 'Restoring…' : 'Restore'}
    </button>
  )
}

export default function PastClassesSection({ courses }: Props) {
  const [open, setOpen] = useState(false)

  if (courses.length === 0) return null

  return (
    <div className="mt-8">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-muted-text hover:text-dark-text transition-colors text-sm font-medium mb-4"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        Past Classes ({courses.length})
      </button>

      {open && (
        <div className="flex flex-col gap-3">
          {courses.map(course => (
            <div
              key={course.id}
              className="bg-surface rounded-2xl border border-border p-4 sm:p-6 flex flex-col gap-3 opacity-75"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/instructor/courses/${course.id}`} className="font-semibold text-dark-text">
                  {course.name}
                </Link>
                {course.start_date && (
                  <span className="text-xs text-muted-text shrink-0">
                    {formatDate(course.start_date)}
                    {course.end_date ? ` – ${formatDate(course.end_date)}` : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <Link href={`/instructor/courses/${course.id}`} className="text-teal-primary text-sm font-medium">
                  Manage →
                </Link>
                <UnarchiveButton courseId={course.id} courseName={course.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
