'use client'
import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DOMPurify from 'isomorphic-dompurify'
import { upsertAccommodation } from '@/lib/accommodation-actions'
import DatePickerField from '@/components/ui/DatePickerField'
import RichTextEditor from '@/components/ui/RichTextEditor'

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
  readOnly?: boolean
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


function useClickOutside(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) onClose()
  }, [ref, onClose])

  useEffect(() => {
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [handleOutsideClick])
}

// Position a popover below (or above if near viewport bottom), clamped horizontally
function popoverCoords(rect: DOMRect, width: number, estimatedHeight: number): { top: number; left: number } {
  const margin = 8
  const spaceBelow = window.innerHeight - rect.bottom - 6
  const top = spaceBelow >= estimatedHeight
    ? rect.bottom + 6
    : Math.max(margin, rect.top - estimatedHeight - 6)
  const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin))
  return { top, left }
}

function isCameraOffActive(acc: Accommodation | null): boolean {
  if (!acc?.cameraOff) return false
  // Compare YYYY-MM-DD strings in local time to avoid UTC timezone shift
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  if (acc.cameraOffStart && todayStr < acc.cameraOffStart) return false
  if (!acc.cameraOffEnd) return true
  return acc.cameraOffEnd >= todayStr
}

function CameraDatePopover({
  start, end, onClose, onSave, onRemove, readOnly,
}: {
  start: string | null
  end: string | null
  onClose: () => void
  onSave: (start: string, end: string) => Promise<void>
  onRemove?: () => Promise<void>
  readOnly?: boolean
}) {
  const [editStart, setEditStart] = useState(start ?? '')
  const [editEnd, setEditEnd] = useState(end ?? '')
  const noDatesSet = !start && !end
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const handleRemove = async () => {
    if (!onRemove) return
    setRemoving(true)
    setError(null)
    try {
      await onRemove()
    } catch {
      setError('Failed to remove.')
    }
    setRemoving(false)
  }

  const fmt = (d: string | null) => d
    ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface border border-border rounded-xl shadow-xl p-4 flex flex-col gap-3 w-80 max-h-[90vh] overflow-y-auto">
        <p className="text-xs font-semibold text-muted-text uppercase tracking-wide flex items-center gap-1.5">
          <CalendarIcon size={11} /> Camera Off Dates
        </p>
        {readOnly ? (
          <div className="flex flex-col gap-1.5">
            {noDatesSet ? (
              <p className="text-xs text-muted-text italic">No dates set.</p>
            ) : (
              <>
                <p className="text-xs text-muted-text">Start: <span className="text-dark-text font-medium">{fmt(start)}</span></p>
                <p className="text-xs text-muted-text">End: <span className="text-dark-text font-medium">{fmt(end)}</span></p>
              </>
            )}
            <button onClick={onClose} className="text-xs text-muted-text hover:text-dark-text transition-colors mt-1 text-left">
              Close
            </button>
          </div>
        ) : (
          <>
            {noDatesSet && (
              <p className="text-xs text-muted-text italic bg-border/30 rounded-lg px-2.5 py-1.5">
                No dates set yet
              </p>
            )}
            <div className="flex flex-col gap-2">
              <DatePickerField
                label="Start date"
                value={editStart}
                onChange={setEditStart}
                placeholder="Pick a start date"
                className="text-xs [&_label]:text-xs [&_label]:text-muted-text [&_label]:font-normal"
              />
              <DatePickerField
                label="End date"
                value={editEnd}
                onChange={setEditEnd}
                placeholder="Pick an end date"
                className="text-xs [&_label]:text-xs [&_label]:text-muted-text [&_label]:font-normal"
              />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex items-center justify-between">
              <button
                onClick={handleSave}
                disabled={saving || removing}
                className="text-xs font-semibold bg-red-500 text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save dates'}
              </button>
              <div className="flex items-center gap-3">
                {onRemove && (
                  <button
                    onClick={handleRemove}
                    disabled={saving || removing}
                    className="text-xs text-muted-text hover:text-red-500 disabled:opacity-50 transition-colors"
                  >
                    {removing ? 'Removing…' : 'Remove'}
                  </button>
                )}
                <button onClick={onClose} className="text-xs text-muted-text hover:text-dark-text transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

function NotesEditPopover({
  notes: initialNotes,
  onClose,
  onSave,
  readOnly,
}: {
  notes: string
  onClose: () => void
  onSave: (notes: string) => Promise<void>
  readOnly?: boolean
}) {
  const [text, setText] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface border border-border rounded-xl shadow-xl p-4 flex flex-col gap-3 w-[480px] max-w-full max-h-[90vh] overflow-y-auto">
        <p className="text-xs font-semibold text-muted-text uppercase tracking-wide">Other Accommodations</p>
        {readOnly ? (
          <>
            <div
              className="text-sm text-dark-text leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_strong]:font-bold"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(initialNotes) }}
            />
            <button onClick={onClose} className="text-xs text-muted-text hover:text-dark-text transition-colors text-left">
              Close
            </button>
          </>
        ) : (
          <>
            <RichTextEditor
              content={text}
              onChange={setText}
              placeholder="e.g. Extended time, quiet testing room, screen reader…"
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
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

function AddAccommodationMenu({
  onCameraOff,
  onNotes,
  onClose,
  hasCameraOff,
  fixedPos,
}: {
  onCameraOff: () => void
  onNotes: () => void
  onClose: () => void
  hasCameraOff: boolean
  fixedPos: { top: number; left: number }
}) {
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onClose)

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top: fixedPos.top, left: fixedPos.left, zIndex: 50 }}
      className="bg-surface border border-border rounded-xl shadow-xl py-1 w-52 text-left"
    >
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
    </div>,
    document.body
  )
}

export default function RosterView({ courses, currentCourseId, students, readOnly }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [openPopover, setOpenPopover] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState<string | null>(null)
  const [addMenuPos, setAddMenuPos] = useState<{ top: number; left: number } | null>(null)
  const addBtnRectRef = useRef<DOMRect | null>(null)

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
            {/* Camera Off badge — always shown when cameraOff=true; dimmed if not currently active */}
            {student.accommodation?.cameraOff && (
              <button
                type="button"
                onClick={() => {
                  setAddMenuOpen(null)
                  setOpenPopover(p => p === `${student.userId}:camera` ? null : `${student.userId}:camera`)
                }}
                className={`inline-flex items-center justify-center text-white w-7 h-7 rounded-full transition-colors ${
                  isCameraOffActive(student.accommodation)
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-red-300 hover:bg-red-400'
                }`}
                title={isCameraOffActive(student.accommodation) ? 'Camera Off (active)' : 'Camera Off (scheduled)'}
              >
                <CameraOffIcon size={13} />
              </button>
            )}
            {openPopover === `${student.userId}:camera` && student.accommodation?.cameraOff && (
              <CameraDatePopover
                start={student.accommodation?.cameraOffStart ?? null}
                end={student.accommodation?.cameraOffEnd ?? null}
                readOnly={readOnly}
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
                onRemove={async () => {
                  const result = await upsertAccommodation(
                    student.userId, false,
                    student.accommodation?.notes ?? '',
                    null, null,
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

            {/* Accommodations (notes) badge */}
            {student.accommodation?.notes && (
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
            )}
            {openPopover === `${student.userId}:notes` && student.accommodation?.notes && (
              <NotesEditPopover
                notes={student.accommodation.notes}
                readOnly={readOnly}
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
        </td>
        <td className="px-4 py-3 text-right">
          {!readOnly && (
          <button
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              addBtnRectRef.current = rect
              setAddMenuPos(popoverCoords(rect, 208, hasCameraOff(student) ? 44 : 88))
              setOpenPopover(null)
              setAddMenuOpen(p => p === student.userId ? null : student.userId)
            }}
            className="w-6 h-6 rounded-full bg-surface border border-border hover:bg-teal-light hover:border-teal-primary text-muted-text hover:text-teal-primary text-sm font-bold flex items-center justify-center transition-colors leading-none"
            title="Add accommodation"
          >
            +
          </button>
          )}
          {addMenuOpen === student.userId && addMenuPos && (
            <AddAccommodationMenu
              hasCameraOff={!!student.accommodation?.cameraOff}
              fixedPos={addMenuPos}
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
          {/* Add-new notes popover via portal */}
          {openPopover === `${student.userId}:notes` && !student.accommodation?.notes && (
            <NotesEditPopover
              notes=""
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
        </td>
      </tr>
    ))
  }

  function hasCameraOff(s: Student) {
    return isCameraOffActive(s.accommodation)
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
        {activeStudents.filter(s => isCameraOffActive(s.accommodation)).length > 0 && (
          <span className="ml-3 inline-flex items-center gap-1 text-red-600">
            <CameraOffIcon size={12} />
            {activeStudents.filter(s => isCameraOffActive(s.accommodation)).length} camera off
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
