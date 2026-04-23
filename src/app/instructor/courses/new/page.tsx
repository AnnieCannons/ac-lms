'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DatePickerField from '@/components/ui/DatePickerField'

export default function NewCoursePage() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [syllabus, setSyllabus] = useState('')
  const [paidLearners, setPaidLearners] = useState(false)
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
        paid_learners: paidLearners,
      })
      .select()
      .single()

    if (error) { setError(error.message); return }

    // Enroll the creator as instructor so wiki/resource actions can verify course access
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('course_enrollments').insert({
        user_id: user.id,
        course_id: data.id,
        role: 'instructor',
      })
    }

    router.push(`/instructor/courses/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <Link href="/instructor/courses" className="text-xl font-extrabold text-dark-text">
          AC<span className="text-teal-primary">*</span>
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-8 py-12">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/instructor/courses" className="text-muted-text hover:text-teal-primary text-sm">
            ← Courses
          </Link>
          <span className="text-border">/</span>
          <h2 className="text-2xl font-bold text-dark-text">New Course</h2>
        </div>

        <div className="bg-surface rounded-2xl border border-border shadow-sm p-8">
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
                className="w-full bg-background border border-border rounded-lg p-3 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
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
                className="w-full bg-background border border-border rounded-lg p-3 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <DatePickerField label="Start Date" value={startDate} onChange={setStartDate} />
              <DatePickerField label="End Date" value={endDate} onChange={setEndDate} />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">Syllabus</label>
              <textarea
                placeholder="Course overview, goals, expectations..."
                value={syllabus}
                onChange={e => setSyllabus(e.target.value)}
                rows={5}
                className="w-full bg-background border border-border rounded-lg p-3 text-sm text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-dark-text mb-2">Course Type</p>
              <button
                type="button"
                onClick={() => setPaidLearners(v => !v)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-colors w-full ${
                  paidLearners
                    ? 'border-teal-primary bg-teal-light text-teal-primary'
                    : 'border-border text-muted-text hover:border-teal-primary'
                }`}
              >
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                  paidLearners ? 'bg-teal-primary border-teal-primary' : 'border-border'
                }`}>
                  {paidLearners && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                Paid learners (enables Benefits &amp; PTO in student sidebar)
              </button>
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
