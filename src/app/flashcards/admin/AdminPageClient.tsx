'use client'
import { useState } from 'react'

type Course = { id: string; name: string }

type Props = {
  courses: Course[]
}

export default function AdminPageClient({ courses }: Props) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id ?? '')

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-10">

      {/* Course selector */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <label htmlFor="course-select" className="block text-sm font-medium text-dark-text mb-3">
          Select Course
        </label>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-text">No active courses found.</p>
        ) : (
          <select
            id="course-select"
            value={selectedCourseId}
            onChange={e => setSelectedCourseId(e.target.value)}
            className="w-full px-4 py-3 border border-border rounded-lg bg-background text-dark-text focus:ring-2 focus:ring-teal-primary focus:border-transparent"
          >
            <option value="">Choose a course</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Stats section — coming in Chunk 3b */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="text-base font-semibold text-dark-text mb-4">Student Activity</h2>
        <p className="text-sm text-muted-text">Student activity table coming soon.</p>
      </section>

    </div>
  )
}
