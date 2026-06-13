'use client'
import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import { submitExtensionRequest, cancelExtensionRequest } from '@/lib/extension-actions'
import type { ExtensionRequest } from '@/lib/extension-actions'

const REASONS = [
  { value: 'not_enough_time', label: 'I did not have enough time to complete the assignment' },
  { value: 'bug', label: 'I have a bug that I can\'t figure out' },
  { value: 'dont_understand', label: 'I don\'t understand the assignment' },
  { value: 'other', label: 'Other' },
]

const PLAN_OPTIONS = [
  { value: 'calendar', label: 'Make time in my calendar' },
  { value: 'ask_help', label: 'Ask for help' },
  { value: 'other', label: 'Other' },
]

// Returns the local hour equivalent of 11:59pm Eastern, based on the user's timezone.
// EST = UTC-5, EDT = UTC-4. We compute the offset dynamically.
function getDefaultExtensionTime(date: Date): Date {
  // 11:59pm Eastern = 04:59 UTC (EST) or 03:59 UTC (EDT)
  // Construct midnight Eastern by checking offset
  const testDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 0)
  // Use Intl to find Eastern offset on this date
  const easternFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  // Build 11:59pm ET on the selected date as a UTC timestamp
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(testDate)
  void easternFormatter
  void etParts

  // Simpler approach: create a Date that is 11:59pm ET on the chosen day
  // by using the IANA timezone approach
  const isoLike = `${format(date, 'yyyy-MM-dd')}T23:59:00`
  // Parse as Eastern time
  const utcMs = Date.parse(
    new Date(isoLike).toLocaleString('en-US', { timeZone: 'America/New_York' })
  )
  // Compute offset: Eastern time string → UTC
  const localParsed = new Date(isoLike)
  const easternAsLocal = new Date(
    new Date(isoLike).toLocaleString('en-US', { timeZone: 'America/New_York' })
  )
  const offset = localParsed.getTime() - easternAsLocal.getTime()
  void utcMs
  const etMidnight = new Date(localParsed.getTime() + offset)
  return etMidnight
}

function formatLocalDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  })
}

export default function RequestExtensionButton({
  assignmentId,
  courseId,
  existingRequest,
  assignmentTitle,
}: {
  assignmentId: string
  courseId: string
  existingRequest: ExtensionRequest | null
  assignmentTitle: string
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [reason, setReason] = useState('')
  const [reasonOther, setReasonOther] = useState('')
  const [plan, setPlan] = useState<string[]>([])
  const [planOther, setPlanOther] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localRequest, setLocalRequest] = useState<ExtensionRequest | null>(existingRequest)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  function togglePlan(value: string) {
    setPlan(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
  }

  function handleDateSelect(date: Date | undefined) {
    if (!date) { setSelectedDate(undefined); return }
    setSelectedDate(getDefaultExtensionTime(date))
  }

  const canSubmit = reason && (reason !== 'other' || reasonOther.trim()) &&
    plan.length > 0 && (!plan.includes('other') || planOther.trim()) &&
    selectedDate

  async function handleSubmit() {
    if (!canSubmit || !selectedDate) return
    setSubmitting(true)
    setError(null)

    const result = await submitExtensionRequest(
      assignmentId,
      courseId,
      reason,
      reason === 'other' ? reasonOther.trim() : null,
      plan,
      plan.includes('other') ? planOther.trim() : null,
      selectedDate.toISOString(),
      notes.trim() || null
    )

    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setLocalRequest({
      id: result.id!,
      assignment_id: assignmentId,
      student_id: '',
      course_id: courseId,
      reason,
      reason_other: reason === 'other' ? reasonOther : null,
      plan,
      plan_other: plan.includes('other') ? planOther : null,
      requested_due_date: selectedDate.toISOString(),
      notes: notes.trim() || null,
      status: 'pending',
      instructor_comment: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
    })
    setStep('confirm')
  }

  async function handleCancel() {
    if (!localRequest) return
    setCancelling(true)
    const result = await cancelExtensionRequest(localRequest.id, courseId, assignmentId)
    setCancelling(false)
    if (result.error) { setError(result.error); return }
    setLocalRequest(null)
    setOpen(false)
    // Reset form
    setReason(''); setReasonOther(''); setPlan([]); setPlanOther(''); setSelectedDate(undefined); setNotes('')
    setStep('form')
  }

  function openFresh() {
    setStep('form'); setError(null); setOpen(true)
  }

  const statusColors = {
    pending: 'bg-amber-500/10 text-amber-700 border-amber-500',
    approved: 'bg-green-500/10 text-green-700 border-green-500',
    denied: 'bg-red-500/10 text-red-700 border-red-500',
  }

  return (
    <>
      {/* Trigger button / status badge */}
      {!localRequest ? (
        <button
          type="button"
          onClick={openFresh}
          className="text-sm font-medium text-teal-primary border border-teal-primary/30 bg-teal-light hover:bg-teal-primary hover:[color:var(--color-background)] rounded-full px-4 py-1.5 transition-colors"
        >
          Request Extension
        </button>
      ) : (
        <button
          type="button"
          onClick={() => { setStep(localRequest.status === 'pending' ? 'form' : 'confirm'); setOpen(true) }}
          className={`text-sm font-medium border rounded-full px-4 py-1.5 transition-colors ${statusColors[localRequest.status]}`}
        >
          Extension: {localRequest.status === 'pending' ? 'Pending' : localRequest.status === 'approved' ? 'Approved' : 'Not Approved'}
        </button>
      )}

      {/* Modal backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            ref={modalRef}
            className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label="Request Extension"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border">
              <h2 className="text-base font-semibold text-dark-text">
                {localRequest?.status === 'approved' ? 'Extension Approved' :
                 localRequest?.status === 'denied' ? 'Extension Request' :
                 localRequest ? 'Extension Pending' :
                 'Request Extension'}
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-text hover:text-dark-text transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="px-6 py-5">
              {/* ── Status view (after submit or existing non-pending) ── */}
              {localRequest && step === 'confirm' && (
                <div className="flex flex-col gap-4">
                  {localRequest.status === 'pending' && (
                    <>
                      <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 text-sm text-amber-700">
                        Your request has been submitted and is waiting for instructor review.
                      </div>
                      <div className="text-sm text-muted-text">
                        <span className="font-medium text-dark-text">Requested date:</span>{' '}
                        {formatLocalDateTime(new Date(localRequest.requested_due_date))}
                      </div>
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="text-sm text-red-500 hover:text-red-700 underline disabled:opacity-50 self-start"
                      >
                        {cancelling ? 'Cancelling…' : 'Cancel this request'}
                      </button>
                    </>
                  )}
                  {localRequest.status === 'approved' && (
                    <>
                      <div className="bg-green-500/10 border border-green-500/40 rounded-xl p-4 text-sm text-green-700 font-medium">
                        Your extension was approved!
                      </div>
                      <div className="text-sm text-muted-text">
                        <span className="font-medium text-dark-text">New due date:</span>{' '}
                        {formatLocalDateTime(new Date(localRequest.requested_due_date))}
                      </div>
                      {localRequest.instructor_comment && (
                        <div className="bg-surface border border-border rounded-xl p-4">
                          <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Note from instructor</p>
                          <p className="text-sm text-dark-text">{localRequest.instructor_comment}</p>
                        </div>
                      )}
                    </>
                  )}
                  {localRequest.status === 'denied' && (
                    <>
                      <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 text-sm text-red-700">
                        Your request for an extension on &ldquo;{assignmentTitle}&rdquo; cannot be accommodated at this time. Please reach out to your instructor if you have further questions.
                      </div>
                      {localRequest.instructor_comment && (
                        <div className="bg-surface border border-border rounded-xl p-4">
                          <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">Note from instructor</p>
                          <p className="text-sm text-dark-text">{localRequest.instructor_comment}</p>
                        </div>
                      )}
                    </>
                  )}
                  {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
              )}

              {/* ── Request form ── */}
              {!localRequest && step === 'form' && (
                <form onSubmit={e => { e.preventDefault(); handleSubmit() }} className="flex flex-col gap-5">
                  {/* Reason */}
                  <fieldset>
                    <legend className="text-sm font-semibold text-dark-text mb-2">
                      Why do you need an extension? <span className="text-red-500">*</span>
                    </legend>
                    <div className="flex flex-col gap-2">
                      {REASONS.map(r => (
                        <label key={r.value} className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="reason"
                            value={r.value}
                            checked={reason === r.value}
                            onChange={() => setReason(r.value)}
                            className="mt-0.5 accent-teal-primary"
                          />
                          <span className="text-sm text-dark-text">{r.label}</span>
                        </label>
                      ))}
                      {reason === 'other' && (
                        <textarea
                          value={reasonOther}
                          onChange={e => setReasonOther(e.target.value)}
                          placeholder="Please describe…"
                          rows={2}
                          className="ml-5 text-sm border border-border rounded-lg px-3 py-2 bg-surface text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
                          required
                        />
                      )}
                    </div>
                  </fieldset>

                  {/* Plan */}
                  <fieldset>
                    <legend className="text-sm font-semibold text-dark-text mb-2">
                      What will you do to complete the assignment? <span className="text-red-500">*</span>
                    </legend>
                    <div className="flex flex-col gap-2">
                      {PLAN_OPTIONS.map(p => (
                        <label key={p.value} className="flex items-start gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            value={p.value}
                            checked={plan.includes(p.value)}
                            onChange={() => togglePlan(p.value)}
                            className="mt-0.5 accent-teal-primary"
                          />
                          <span className="text-sm text-dark-text">{p.label}</span>
                        </label>
                      ))}
                      {plan.includes('other') && (
                        <textarea
                          value={planOther}
                          onChange={e => setPlanOther(e.target.value)}
                          placeholder="Please describe…"
                          rows={2}
                          className="ml-5 text-sm border border-border rounded-lg px-3 py-2 bg-surface text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
                          required
                        />
                      )}
                    </div>
                  </fieldset>

                  {/* Date picker */}
                  <div>
                    <p className="text-sm font-semibold text-dark-text mb-2">
                      When will the assignment be done? <span className="text-red-500">*</span>
                    </p>
                    <div className="border border-border rounded-xl overflow-hidden bg-surface">
                      <DayPicker
                        mode="single"
                        selected={selectedDate}
                        onSelect={handleDateSelect}
                        disabled={{ before: new Date() }}
                        defaultMonth={new Date()}
                        components={{
                          Chevron: ({ orientation }: { orientation?: string }) => (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--color-dark-text)' }}>
                              {orientation === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
                            </svg>
                          ),
                        }}
                        classNames={{
                          root: 'text-sm p-2', months: 'flex', month: 'relative space-y-2',
                          month_caption: 'flex items-center justify-center px-8 py-1',
                          caption_label: 'text-sm font-semibold text-dark-text',
                          nav: 'absolute top-0 left-0 right-0 flex items-center justify-between z-10',
                          button_previous: 'p-2 rounded-lg hover:bg-teal-light text-dark-text transition-colors',
                          button_next: 'p-2 rounded-lg hover:bg-teal-light text-dark-text transition-colors',
                          month_grid: 'w-full', weekdays: 'flex',
                          weekday: 'w-9 text-center text-xs text-muted-text py-1',
                          week: 'flex', day: 'w-9 h-9',
                          day_button: 'w-full h-full flex items-center justify-center rounded-lg text-sm text-dark-text hover:bg-teal-light hover:text-teal-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
                          selected: '[&>button]:bg-teal-primary [&>button]:text-white [&>button]:hover:bg-teal-primary [&>button]:hover:text-white',
                          today: '[&>button]:font-bold [&>button]:text-teal-primary',
                          outside: 'opacity-30',
                        }}
                      />
                    </div>
                    {selectedDate && (
                      <p className="mt-2 text-xs text-muted-text">
                        Due time: <span className="font-medium text-dark-text">{formatLocalDateTime(selectedDate)}</span>
                        <span className="ml-1 text-muted-text/60">(11:59pm ET)</span>
                      </p>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-sm font-semibold text-dark-text mb-2 block">
                      Anything else we should know? <span className="text-muted-text font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Any additional context for your instructor…"
                      rows={3}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-surface text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
                    />
                  </div>

                  {error && <p className="text-sm text-red-500">{error}</p>}

                  <div className="flex gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={!canSubmit || submitting}
                      className="flex-1 bg-teal-primary text-white text-sm font-semibold py-2 rounded-full hover:bg-teal-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? 'Submitting…' : 'Submit Request'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="px-5 text-sm text-muted-text hover:text-dark-text transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
