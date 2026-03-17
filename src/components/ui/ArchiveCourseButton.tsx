'use client'

import { useState } from 'react'
import { archiveCourse } from '@/lib/course-actions'

interface Props {
  courseId: string
  courseName: string
  endDate: string | null
}

export default function ArchiveCourseButton({ courseId, courseName, endDate }: Props) {
  const [loading, setLoading] = useState(false)

  // Only show if end_date has passed
  if (!endDate || new Date(endDate).getTime() >= Date.now()) return null

  async function handleArchive() {
    if (!confirm(`Move "${courseName}" to Past Classes?`)) return
    setLoading(true)
    const result = await archiveCourse(courseId, true)
    if (result.error) {
      alert(result.error)
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleArchive}
      disabled={loading}
      className="text-xs text-muted-text hover:text-teal-primary transition-colors shrink-0 disabled:opacity-50"
    >
      {loading ? 'Moving…' : 'Add to Past Classes →'}
    </button>
  )
}
