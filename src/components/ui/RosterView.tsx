'use client'
import { useState, useTransition, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { upsertAccommodation } from '@/lib/accommodation-actions'

interface Accommodation {
  cameraOff: boolean
  cameraOffStart: string | null
  cameraOffEnd: string | null
  notes: string
}

interface Student {
  userId: string
  name: string
  email: string
  accommodation: Accommodation | null
  enrollmentRole?: 'student' | 'observer'
}

interface CourseTab {
  id: string
  name: string
}

interface Props {
  courses: CourseTab[]
  currentCourseId: string
  students: Student[]
}

function CameraOffIcon({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12" />
      <path d="M9.5 4h5l2 3h3" />
      <polyline points="22 8 22 18" />
    </svg>
  )
}

function CalendarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(str: string) {
  const [year, month, day] = str.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateRange(start: string | null, end: string | null) {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`
  if (end) return `Until ${formatDate(end)}`
  if (start) return `From ${formatDate(start)}`
  return 'No dates set'
}

export default function RosterView({ courses, currentCourseId, students }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editingFor, setEditingFor] = useState<string | null>(null)
  const [cameraOff, setCameraOff] = useState(false)
  const [cameraOffStart, setCameraOffStart] = useState('')
  const [cameraOffEnd, setCameraOffEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [openPopover, setOpenPopover] = useState<string | null>(null)

  function startEdit(student: Student) {
    setEditingFor(student.userId)
    setCameraOff(student.accommodation?.cameraOff ?? false)
    setCameraOffStart(student.accommodation?.cameraOffStart ?? todayStr())
    setCameraOffEnd(student.accommodation?.cameraOffEnd ?? '')
    setNotes(student.accommodation?.notes ?? '')
    setSaveError(null)
    setOpenPopover(null)
  }

  function cancelEdit() {
    setEditingFor(null)
    setSaveError(null)
  }

  function handleToggleCamera(newVal: boolean) {
    setCameraOff(newVal)
    if (newVal) {
      setCameraOffStart(todayStr())
      setCameraOffEnd('')
    } else {
      setCameraOffStart('')
      setCameraOffEnd('')
    }
  }

  async function handleSave(userId: string) {
    setSaving(true)
    setSaveError(null)
    const result = await upsertAccommodation(
      userId,
      cameraOff,
      notes,
      cameraOff ? cameraOffStart || null : null,
      cameraOff ? cameraOffEnd || null : null,
    )
    setSaving(false)
    if (result.error) {
      setSaveError(result.error)
    } else {
      setEditingFor(null)
      startTransition(() => router.refresh())
    }
  }

  const hasAnyAccommodation = (s: Student) =>
    s.accommodation?.cameraOff || s.accommodation?.notes

  const activeStudents = students.filter(s => s.enrollmentRole !== 'observer')
  const observers = students.filter(s => s.enrollmentRole === 'observer')

  function renderStudentRows(list: Student[], muted = false) {
    return list.map(student => (
      <Fragment key={student.userId}>
        <tr className={`bg-background ${muted ? 'opacity-60' : ''} ${hasAnyAccommodation(student) ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}>
          <td className="px-4 py-3 font-medium text-dark-text">
            <Link
              href={`/instructor/courses/${currentCourseId}/roster/${student.userId}`}
              className="hover:text-teal-primary hover:underline"
            >
              {student.name || '—'}
            </Link>
          </td>
          <td className="px-4 py-3 text-muted-text">{student.email}</td>
          <td className="px-4 py-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                {student.accommodation?.cameraOff && (
                  <button
                    type="button"
                    onClick={() => setOpenPopover(p => p === `${student.userId}:camera` ? null : `${student.userId}:camera`)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-red-500 px-2.5 py-1 rounded-full hover:bg-red-600 transition-colors"
                  >
                    <CameraOffIcon size={12} />
                    Camera Off
                  </button>
                )}
                {student.accommodation?.notes && (
                  <button
                    type="button"
                    onClick={() => setOpenPopover(p => p === `${student.userId}:notes` ? null : `${student.userId}:notes`)}
                    className="text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-full transition-colors"
                  >
                    Notes
                  </button>
                )}
                {!hasAnyAccommodation(student) && (
                  <span className="text-xs text-muted-text">—</span>
                )}
              </div>

              {/* Camera Off popover */}
              {openPopover === `${student.userId}:camera` && (
                <div className="flex items-center gap-2 text-xs text-dark-text bg-surface border border-border rounded-lg px-3 py-2 w-fit">
                  <CalendarIcon size={12} />
                  <span>{formatDateRange(student.accommodation?.cameraOffStart ?? null, student.accommodation?.cameraOffEnd ?? null)}</span>
                </div>
              )}

              {/* Notes popover */}
              {openPopover === `${student.userId}:notes` && (
                <div className="text-xs text-dark-text bg-surface border border-border rounded-lg px-3 py-2 max-w-xs whitespace-pre-wrap">
                  {student.accommodation?.notes}
                </div>
              )}
            </div>
          </td>
          <td className="px-4 py-3 text-right">
            <button
              onClick={() => editingFor === student.userId ? cancelEdit() : startEdit(student)}
              className="text-xs font-medium text-teal-primary hover:underline"
            >
              {editingFor === student.userId ? 'Cancel' : 'Edit'}
            </button>
          </td>
        </tr>

        {editingFor === student.userId && (
          <tr className="bg-surface">
            <td colSpan={4} className="px-6 py-5">
              <div className="flex flex-col gap-4 max-w-lg">
                {/* Camera Off toggle */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => handleToggleCamera(!cameraOff)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${cameraOff ? 'bg-red-500' : 'bg-border'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${cameraOff ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </div>
                  <span className="flex items-center gap-2 text-sm font-medium text-dark-text">
                    <CameraOffIcon size={15} />
                    Camera Off accommodation
                  </span>
                </label>

                {/* Date pickers — only shown when camera off is ON */}
                {cameraOff && (
                  <div className="flex gap-4 flex-wrap">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted-text flex items-center gap-1.5">
                        <CalendarIcon size={11} />
                        Start date
                      </label>
                      <input
                        type="date"
                        value={cameraOffStart}
                        onChange={e => setCameraOffStart(e.target.value)}
                        className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted-text flex items-center gap-1.5">
                        <CalendarIcon size={11} />
                        End date
                      </label>
                      <input
                        type="date"
                        value={cameraOffEnd}
                        min={cameraOffStart || undefined}
                        onChange={e => setCameraOffEnd(e.target.value)}
                        className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-muted-text mb-1.5">
                    Other accommodations / notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                    placeholder="e.g. Extended time, quiet testing room, screen reader…"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none placeholder:text-muted-text"
                  />
                </div>

                {saveError && (
                  <p className="text-xs text-red-600">{saveError}</p>
                )}

                <button
                  onClick={() => handleSave(student.userId)}
                  disabled={saving}
                  className="self-start bg-teal-primary text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-teal-primary/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    ))
  }

  const tableHeader = (
    <thead>
      <tr className="bg-surface border-b border-border">
        <th className="text-left px-4 py-3 font-semibold text-muted-text">Name</th>
        <th className="text-left px-4 py-3 font-semibold text-muted-text">Email</th>
        <th className="text-left px-4 py-3 font-semibold text-muted-text">Accommodations</th>
        <th className="sr-only">Actions</th>
      </tr>
    </thead>
  )

  return (
    <div>
      {/* Course tabs */}
      <div className={`flex border-b border-border mb-8 overflow-x-auto ${courses.length <= 1 ? 'hidden' : ''}`}>
        {courses.map(course => (
          <Link
            key={course.id}
            href={`/instructor/courses/${course.id}/roster`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap -mb-px transition-colors ${
              course.id === currentCourseId
                ? 'border-teal-primary text-teal-primary'
                : 'border-transparent text-muted-text hover:text-dark-text hover:border-border'
            }`}
          >
            {course.name}
          </Link>
        ))}
      </div>

      {/* Active student count */}
      <p className="text-sm text-muted-text mb-4">
        {activeStudents.length} {activeStudents.length === 1 ? 'student' : 'students'}
        {activeStudents.filter(s => s.accommodation?.cameraOff).length > 0 && (
          <span className="ml-3 inline-flex items-center gap-1 text-red-600">
            <CameraOffIcon size={12} />
            {activeStudents.filter(s => s.accommodation?.cameraOff).length} camera off
          </span>
        )}
      </p>

      {activeStudents.length === 0 && observers.length === 0 ? (
        <div className="border border-border rounded-lg p-8 text-center text-sm text-muted-text">
          No students enrolled in this course.
        </div>
      ) : (
        <>
          {activeStudents.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden mb-8">
              <table className="w-full text-sm">
                {tableHeader}
                <tbody className="divide-y divide-border">
                  {renderStudentRows(activeStudents)}
                </tbody>
              </table>
            </div>
          )}

          {observers.length > 0 && (
            <>
              <h2 className="text-base font-semibold text-dark-text mb-1">Observers — On Leave</h2>
              <p className="text-xs text-muted-text mb-4">{observers.length} {observers.length === 1 ? 'student' : 'students'} paused</p>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  {tableHeader}
                  <tbody className="divide-y divide-border">
                    {renderStudentRows(observers, true)}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
