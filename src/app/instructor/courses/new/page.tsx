'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewCoursePage() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [syllabus, setSyllabus] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data, error } = await supabase
      .from('courses')
      .insert({
        name,
        code,
        start_date: startDate || null,
        end_date: endDate || null,
        syllabus_content: syllabus || null,
      })
      .select()
      .single()

    if (error) { setError(error.message); return }
    router.push(`/instructor/courses/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
        <Link href="/instructor/courses" className="text-xl font-extrabold text-dark-text">
          AC<span className="text-teal-primary">*</span>
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-8 py-12">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/instructor/courses" className="text-gray-400 hover:text-teal-primary text-sm">
            ← Courses
          </Link>
          <span className="text-gray-300">/</span>
          <h2 className="text-2xl font-bold text-dark-text">New Course</h2>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-6">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">Course Name</label>
              <input
                type="text"
                placeholder="e.g. Intro to Web Development"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">Course Code</label>
              <input
                type="text"
                placeholder="e.g. WEB101"
                value={code}
                onChange={e => setCode(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">Syllabus</label>
              <textarea
                placeholder="Course overview, goals, expectations..."
                value={syllabus}
                onChange={e => setSyllabus(e.target.value)}
                rows={5}
                className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
              />
            </div>
            <button
              type="submit"
              className="bg-teal-primary text-white font-semibold py-3 rounded-full hover:opacity-90 transition-opacity"
            >
              Create Course
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}