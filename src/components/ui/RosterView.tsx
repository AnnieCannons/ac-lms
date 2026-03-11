'use client'
import { useState, useTransition, Fragment, useRef, useEffect, useCallback } from 'react'
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

function useClickOutside(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) onClose()
  }, [ref, onClose])

  useEffect(() => {
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [handleOutsideClick])
}

function CameraDatePopover({
  start, end, onClose, onSave, containerClassName,
}: {
  start: string | null
  end: string | null
  onClose: () => void
  onSave: (start: string, end: string) => Promise<void>
  containerClassName?: string
}) {
  const [editStart, setEditStart] = useState(start ?? todayStr())
  const [editEnd, setEditEnd] = useState(end ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onClose)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(editStart, editEnd)
    } catch {
      setError('Failed to save.')
    }
    setSaving(false)
  }

  return (
    <div
      ref={ref}
      className={containerClassName ?? "absolute z-30 top-full mt-1 left-0 bg-surface border border-border rounded-xl shadow-xl p-3 flex flex-col gap-3 w-60"}
    >
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide flex items-center gap-1.5">
        <CalendarIcon size={11} /> Camera Off Dates
      </p>
      <div className="flex flex-col gap-2">
        <div>
          <label className="text-xs text-muted-text block mb-1">Start date</label>
          <input
            type="date"
            value={editStart}
            onChange={e => setEditStart(e.target.value)}
            className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>
        <div>
          <label className="text-xs text-muted-text block mb-1">End date</label>
          <input
            type="date"
            value={editEnd}
            min={editStart || undefined}
            onChange={e => setEditEnd(e.target.value)}
            className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center justify-between">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs font-semibold bg-red-500 text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save dates'}
        </button>
        <button onClick={onClose} className="text-xs text-muted-text hover:text-dark-text transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

function NotesEditPopover({
  notes: initialNotes,
  onClose,
  onSave,
  containerClassName,
}: {
  notes: string
  onClose: () => void
  onSave: (notes: string) => Promise<void>
  containerClassName?: string
}) {
  const [text, setText] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onClose)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(text)
    } catch {
      setError('Failed to save.')
    }
    setSaving(false)
  }

  return (
    <div ref={ref} className={containerClassName ?? "absolute z-30 top-full mt-1 left-0 bg-surface border border-border rounded-xl shadow-xl p-3 flex flex-col gap-3 w-64"}>
      <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Other Accommodations</p>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        autoFocus
        placeholder="e.g. Extended time, quiet testing room, screen reader…"
        className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none placeholder:text-muted-text"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center justify-between">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs font-semibold bg-teal-primary text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onClose} className="text-xs text-muted-text hover:text-dark-text transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

function AddAccommodationMenu({
  onCameraOff,
  onNotes,
  onClose,
  hasCameraOff,
}: {
  onCameraOff: () => void
  onNotes: () => void
  onClose: () => void
  hasCameraOff: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onClose)

  return (
    <div ref={ref} className="absolute z-30 top-full mt-1 right-0 bg-surface border border-border rounded-xl shadow-xl py-1 w-52 text-left">
      {!hasCameraOff && (
        <button
          onClick={onCameraOff}
          className="w-full text-left text-xs px-3 py-2.5 hover:bg-teal-light/20 text-dark-text flex items-center gap-2 transition-colors"
        >
          <CameraOffIcon size={12} />
          Camera Off
        </button>
      )}
      <button
        onClick={onNotes}
        className="w-full text-left text-xs px-3 py-2.5 hover:bg-teal-light/20 text-dark-text transition-colors"
      >
        Other Accommodation
      </button>
    </div>
  )
}

export default function RosterView({ courses, currentCourseId, students }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [openPopover, setOpenPopover] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState<string | null>(null)

  const hasAnyAccommodation = (s: Student) =>
    s.accommodation?.cameraOff || s.accommodation?.notes

  const activeStudents = students.filter(s => s.enrollmentRole !== 'observer')
  const observers = students.filter(s => s.enrollmentRole === 'observer')

  function renderStudentRows(list: Student[], muted = false) {
    return list.map(student => (
      <tr
        key={student.userId}
        className={`bg-background ${muted ? 'opacity-60' : ''} ${hasAnyAccommodation(student) ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}
      >
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
          <div className="flex items-center gap-2 flex-wrap">
            {/* Camera Off badge */}
            {student.accommodation?.cameraOff && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setAddMenuOpen(null)
                    setOpenPopover(p => p === `${student.userId}:camera` ? null : `${student.userId}:camera`)
                  }}
                  className="inline-flex items-center justify-center text-white bg-red-500 w-7 h-7 rounded-full hover:bg-red-600 transition-colors"
                  title="Camera Off"
                >
                  <CameraOffIcon size={13} />
                </button>
                {openPopover === `${student.userId}:camera` && (
                  <CameraDatePopover
                    start={student.accommodation?.cameraOffStart ?? null}
                    end={student.accommodation?.cameraOffEnd ?? null}
                    onClose={() => setOpenPopover(null)}
                    onSave={async (start, end) => {
                      const result = await upsertAccommodation(
                        student.userId, true,
                        student.accommodation?.notes ?? '',
                        start || null, end || null,
                      )
                      if (!result.error) {
                        setOpenPopover(null)
                        startTransition(() => router.refresh())
                      } else {
                        throw new Error(result.error)
                      }
                    }}
                  />
                )}
              </div>
            )}

            {/* Accommodations (notes) badge */}
            {student.accommodation?.notes && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setAddMenuOpen(null)
                    setOpenPopover(p => p === `${student.userId}:notes` ? null : `${student.userId}:notes`)
                  }}
                  className="text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 dark:text-amber-300 dark:bg-amber-900/40 dark:hover:bg-amber-800/50 border border-amber-300 dark:border-amber-600/60 px-2 py-0.5 rounded-full transition-colors"
                >
                  Accommodations
                </button>
                {openPopover === `${student.userId}:notes` && (
                  <NotesEditPopover
                    notes={student.accommodation.notes}
                    onClose={() => setOpenPopover(null)}
                    onSave={async (newNotes) => {
                      const result = await upsertAccommodation(
                        student.userId,
                        student.accommodation?.cameraOff ?? false,
                        newNotes,
                        student.accommodation?.cameraOffStart ?? null,
                        student.accommodation?.cameraOffEnd ?? null,
                      )
                      if (!result.error) {
                        setOpenPopover(null)
                        startTransition(() => router.refresh())
                      } else {
                        throw new Error(result.error)
                      }
                    }}
                  />
                )}
              </div>
            )}

          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => {
                setOpenPopover(null)
                setAddMenuOpen(p => p === student.userId ? null : student.userId)
              }}
              className="w-6 h-6 rounded-full bg-border/60 hover:bg-teal-light/60 text-muted-text hover:text-teal-primary text-sm font-bold flex items-center justify-center transition-colors leading-none"
              title="Add accommodation"
            >
              +
            </button>
            {addMenuOpen === student.userId && (
              <AddAccommodationMenu
                hasCameraOff={!!student.accommodation?.cameraOff}
                onCameraOff={() => {
                  setAddMenuOpen(null)
                  setOpenPopover(`${student.userId}:camera`)
                }}
                onNotes={() => {
                  setAddMenuOpen(null)
                  setOpenPopover(`${student.userId}:notes`)
                }}
                onClose={() => setAddMenuOpen(null)}
              />
            )}
            {/* Add popovers anchored to right edge */}
            {openPopover === `${student.userId}:notes` && !student.accommodation?.notes && (
              <NotesEditPopover
                notes=""
                containerClassName="absolute z-30 top-full mt-1 right-0 bg-surface border border-border rounded-xl shadow-xl p-3 flex flex-col gap-3 w-64"
                onClose={() => setOpenPopover(null)}
                onSave={async (newNotes) => {
                  const result = await upsertAccommodation(
                    student.userId,
                    student.accommodation?.cameraOff ?? false,
                    newNotes,
                    student.accommodation?.cameraOffStart ?? null,
                    student.accommodation?.cameraOffEnd ?? null,
                  )
                  if (!result.error) {
                    setOpenPopover(null)
                    startTransition(() => router.refresh())
                  } else {
                    throw new Error(result.error)
                  }
                }}
              />
            )}
            {openPopover === `${student.userId}:camera` && !student.accommodation?.cameraOff && (
              <CameraDatePopover
                start={null}
                end={null}
                containerClassName="absolute z-30 top-full mt-1 right-0 bg-surface border border-border rounded-xl shadow-xl p-3 flex flex-col gap-3 w-60"
                onClose={() => setOpenPopover(null)}
                onSave={async (start, end) => {
                  const result = await upsertAccommodation(
                    student.userId, true,
                    student.accommodation?.notes ?? '',
                    start || null, end || null,
                  )
                  if (!result.error) {
                    setOpenPopover(null)
                    startTransition(() => router.refresh())
                  } else {
                    throw new Error(result.error)
                  }
                }}
              />
            )}
          </div>
        </td>
      </tr>
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
