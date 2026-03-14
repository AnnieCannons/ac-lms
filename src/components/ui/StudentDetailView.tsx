'use client'
import { useState } from 'react'
import Link from 'next/link'
import { saveGrade } from '@/lib/grade-actions'
import HtmlContent from '@/components/ui/HtmlContent'

export type CategorizedAssignment = {
  id: string
  title: string
  due_date: string | null
  moduleTitle: string
  weekNumber: number | null
  isLate: boolean
  submissionId: string | null
}

type StatCategory = 'missing' | 'late' | 'submitted' | 'incomplete' | 'complete'

interface Props {
  courseId: string
  student: { id: string; name: string; email: string; role: string }
  accommodation: { cameraOff: boolean; notes: string } | null
  lastSignInAt: string | null
  missing: CategorizedAssignment[]
  late: CategorizedAssignment[]
  submitted: CategorizedAssignment[]
  complete: CategorizedAssignment[]
  incomplete: CategorizedAssignment[]
  totalPublished: number
}

const STAT_CONFIG: Record<StatCategory, {
  label: string
  cardClass: string
  ringColor: string
}> = {
  missing:    { label: 'Missing',       cardClass: 'status-missing-card',  ringColor: 'ring-red-400' },
  late:       { label: 'Late',          cardClass: 'status-late-card',     ringColor: 'ring-amber-400' },
  submitted:  { label: 'Needs Grading', cardClass: 'status-grading-card',  ringColor: 'ring-teal-primary' },
  incomplete: { label: 'Needs Revision',cardClass: 'status-revision-card', ringColor: 'ring-orange-400' },
  complete:   { label: 'Complete',      cardClass: 'status-complete-card', ringColor: 'ring-green-500' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

export default function StudentDetailView({
  courseId,
  student,
  accommodation,
  lastSignInAt,
  missing,
  late,
  submitted,
  complete,
  incomplete,
  totalPublished,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<StatCategory | null>(null)

  // Mutable local state for speed grading
  const [lists, setLists] = useState<Record<StatCategory, CategorizedAssignment[]>>({
    missing,
    late,
    submitted,
    incomplete,
    complete,
  })
  const [grading, setGrading] = useState<Record<string, boolean>>({})

  const grade = async (assignment: CategorizedAssignment, result: 'complete' | 'incomplete') => {
    if (!assignment.submissionId || grading[assignment.id]) return
    setGrading(prev => ({ ...prev, [assignment.id]: true }))

    const { error } = await saveGrade(assignment.submissionId, result, student.id, courseId)
    if (error) { setGrading(prev => ({ ...prev, [assignment.id]: false })); return }

    // Move assignment across lists optimistically
    setLists(prev => {
      const removeFrom = (list: CategorizedAssignment[]) => list.filter(a => a.id !== assignment.id)
      const newComplete = result === 'complete'
        ? [...prev.complete, assignment]
        : prev.complete
      const newIncomplete = result === 'incomplete'
        ? [...prev.incomplete, assignment]
        : removeFrom(prev.incomplete)
      return {
        ...prev,
        submitted: removeFrom(prev.submitted),
        incomplete: newIncomplete,
        complete: newComplete,
        // Keep late list in sync — update the entry if it was there
        late: prev.late.map(a => a.id === assignment.id ? { ...a } : a),
      }
    })
    setGrading(prev => ({ ...prev, [assignment.id]: false }))
  }

  const categories: { key: StatCategory; items: CategorizedAssignment[] }[] = [
    { key: 'missing',    items: lists.missing },
    { key: 'late',       items: lists.late },
    { key: 'submitted',  items: lists.submitted },
    { key: 'incomplete', items: lists.incomplete },
    { key: 'complete',   items: lists.complete },
  ]

  const activeItems = activeCategory ? (categories.find(c => c.key === activeCategory)?.items ?? []) : []

  const hasAccommodation = accommodation && (accommodation.cameraOff || accommodation.notes)

  return (
    <div className="flex flex-col gap-8">

      {/* ── Student header ── */}
      <div className="bg-surface rounded-2xl border border-border p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-dark-text">
              {student.name || '(no name)'}
            </h1>
            <p className="text-sm text-muted-text mt-0.5">{student.email}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize shrink-0 ${
            student.role === 'instructor' ? 'bg-purple-100 text-purple-700' :
            student.role === 'admin'      ? 'bg-orange-100 text-orange-700' :
                                            'bg-teal-light text-teal-primary'
          }`}>
            {student.role}
          </span>
        </div>

        <div className="flex flex-col gap-2.5 text-sm border-t border-border pt-4">
          <div className="flex items-start gap-3">
            <span className="text-muted-text shrink-0 w-28">Last login</span>
            <span className="text-dark-text">
              {lastSignInAt ? formatDateTime(lastSignInAt) : <span className="text-muted-text italic">Never logged in</span>}
            </span>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-muted-text shrink-0 w-28">Accommodations</span>
            <div className="flex items-center gap-2 flex-wrap">
              {!hasAccommodation ? (
                <span className="text-muted-text italic">None</span>
              ) : (
                <>
                  {accommodation?.cameraOff && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full border status-camera-badge">
                      Camera off
                    </span>
                  )}
                  {accommodation?.notes && (
                    <HtmlContent html={accommodation.notes} className="text-dark-text text-sm [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_strong]:font-semibold" />
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-muted-text shrink-0 w-28">Progress</span>
            <span className="text-dark-text">
              {lists.complete.length} / {totalPublished} assignments complete
            </span>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">Assignment Breakdown</h2>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
          {categories.map(({ key, items }) => {
            const cfg = STAT_CONFIG[key]
            const isActive = activeCategory === key
            const isEmpty = items.length === 0
            return (
              <button
                key={key}
                type="button"
                onClick={() => !isEmpty && setActiveCategory(isActive ? null : key)}
                disabled={isEmpty}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 sm:p-4 transition-all ${
                  isEmpty
                    ? 'bg-surface border-border opacity-40 cursor-default'
                    : isActive
                      ? `${cfg.cardClass} ring-2 ${cfg.ringColor} shadow-sm`
                      : `${cfg.cardClass} hover:shadow-sm hover:scale-[1.02] cursor-pointer`
                }`}
              >
                <span className={`text-2xl font-bold leading-none ${isEmpty ? 'text-muted-text' : ''}`}>
                  {items.length}
                </span>
                <span className={`text-xs font-medium text-center leading-tight ${isEmpty ? 'text-muted-text' : ''}`}>
                  {cfg.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Expanded assignment list */}
        {activeCategory && (
          <div className="mt-3 border border-border rounded-xl overflow-hidden">
            <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide border-b border-border ${STAT_CONFIG[activeCategory].cardClass}`}>
              {STAT_CONFIG[activeCategory].label} — {activeItems.length} assignment{activeItems.length !== 1 ? 's' : ''}
              {(activeCategory === 'submitted' || activeCategory === 'incomplete') && activeItems.length > 0 && (
                <span className="ml-2 normal-case font-normal text-muted-text">— click to grade inline</span>
              )}
            </div>

            {activeItems.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted-text text-center">None in this category.</p>
            ) : (
              <ul className="divide-y divide-border">
                {activeItems.map(a => {
                  const isGrading = grading[a.id]
                  const canSpeedGrade = (activeCategory === 'submitted' || activeCategory === 'incomplete') && a.submissionId
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-3 bg-background hover:bg-surface transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-dark-text">{a.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-text">
                            {a.moduleTitle}{a.weekNumber != null ? ` · Week ${a.weekNumber}` : ''}
                          </span>
                          {a.due_date && (
                            <span className="text-xs text-muted-text">· Due {formatDate(a.due_date)}</span>
                          )}
                          {a.isLate && (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full border status-late-badge">
                              Late
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {canSpeedGrade && (
                          <>
                            {activeCategory === 'incomplete' && (
                              <button
                                type="button"
                                disabled={isGrading}
                                onClick={() => grade(a, 'complete')}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border status-complete-btn disabled:opacity-50 transition-colors"
                              >
                                {isGrading ? '…' : '✓ Complete'}
                              </button>
                            )}
                            {activeCategory === 'submitted' && (
                              <button
                                type="button"
                                disabled={isGrading}
                                onClick={() => grade(a, 'incomplete')}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border status-revision-btn disabled:opacity-50 transition-colors"
                              >
                                {isGrading ? '…' : '✗ Revision'}
                              </button>
                            )}
                          </>
                        )}
                        <Link
                          href={
                            activeCategory === 'missing'
                              ? `/instructor/courses/${courseId}/assignments/${a.id}`
                              : `/instructor/courses/${courseId}/assignments/${a.id}/submissions/${student.id}`
                          }
                          className="text-xs font-medium text-teal-primary hover:underline"
                        >
                          {canSpeedGrade ? 'View' : activeCategory === 'missing' ? 'View →' : 'Grade →'}
                        </Link>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
