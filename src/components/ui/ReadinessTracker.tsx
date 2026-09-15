'use client'

import { useState, useEffect, useCallback } from 'react'
import { ReadinessTrendChart, ReadinessZoneBadge, EscalationHistorySection, HowThisWorksSection } from '@/components/ui/ReadinessWidgets'
import { getMyReadinessHistory, getMyEscalationStatus, getMyEscalationHistory, submitCheckinForm, type ReadinessHistoryPoint, type EscalationEventRecord } from '@/lib/readiness-actions'
import type { EscalationStatus } from '@/lib/readiness'

function BreakdownStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center px-3 py-2 rounded-xl bg-background border border-border">
      <div className="text-lg font-bold text-dark-text">{value}</div>
      <div className="text-xs text-muted-text">{label}</div>
    </div>
  )
}

function CheckinForm({ courseId, formType, onSubmitted }: {
  courseId: string
  formType: 'acknowledgment' | 'reflection'
  onSubmitted: () => void
}) {
  const [note, setNote] = useState('')
  const [goals, setGoals] = useState('')
  const [reflection, setReflection] = useState('')
  const [obstacles, setObstacles] = useState('')
  const [targetGreenDate, setTargetGreenDate] = useState('')
  const [questionsForInstructor, setQuestionsForInstructor] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (formType === 'acknowledgment' && !acknowledged) {
      setError('Please check the acknowledgment box before submitting.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await submitCheckinForm(
      formType === 'acknowledgment'
        ? { courseId, formType, note }
        : { courseId, formType, goals, reflection, obstacles, targetGreenDate, questionsForInstructor },
    )
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onSubmitted()
  }

  return (
    <div>
      {formType === 'acknowledgment' ? (
        <>
          <label className="flex items-start gap-3 mb-4 p-3.5 rounded-xl bg-background border border-border cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={e => setAcknowledged(e.target.checked)}
              className="mt-0.5 accent-teal-primary shrink-0"
            />
            <span className="text-sm text-dark-text">
              I acknowledge that I&apos;m currently in the student support process.
            </span>
          </label>
          <p className="text-sm text-muted-text mb-2">
            No judgment here — just want to check in. You&apos;re welcome to leave us notes below; anything you want us to know?
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={4}
            placeholder="Optional notes…"
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-dark-text text-sm"
          />
        </>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-dark-text mb-1">What do you think is contributing to you not being able to make progress?</label>
            <textarea value={obstacles} onChange={e => setObstacles(e.target.value)} rows={3}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-dark-text text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-dark-text mb-1">What will change so you can make progress moving forward?</label>
            <textarea value={goals} onChange={e => setGoals(e.target.value)} rows={3}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-dark-text text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-dark-text mb-1">When do you anticipate being back in the green zone?</label>
            <textarea value={targetGreenDate} onChange={e => setTargetGreenDate(e.target.value)} rows={2}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-dark-text text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-dark-text mb-1">Do you have any questions for your instructors?</label>
            <textarea value={questionsForInstructor} onChange={e => setQuestionsForInstructor(e.target.value)} rows={2}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-dark-text text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-dark-text mb-1">Anything else you want to reflect on?</label>
            <textarea value={reflection} onChange={e => setReflection(e.target.value)} rows={3}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-dark-text text-sm" />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <button
        onClick={submit}
        disabled={saving}
        className="mt-5 px-6 py-3 rounded-xl font-bold text-white disabled:opacity-50"
        style={{ backgroundColor: '#6D2B5E' }}
      >
        {saving ? 'Submitting…' : 'Submit'}
      </button>
    </div>
  )
}

const STEPS = [
  { key: 'step1' as const, label: 'Check-in' },
  { key: 'step2' as const, label: 'Reflection' },
  { key: 'step3' as const, label: 'Meeting' },
]

const STEP_COPY: Record<'step1' | 'step2' | 'step3', { eyebrow: string; title: string; explanation: string; next: string | null }> = {
  step1: {
    eyebrow: 'Step 1 of 3',
    title: 'Quick check-in',
    explanation: 'Your readiness score has dropped recently. Before anything else, we just want to check in with you directly.',
    next: 'If things haven’t turned around by next week, the next step is a short reflection form.',
  },
  step2: {
    eyebrow: 'Step 2 of 3',
    title: 'Goals & reflection',
    explanation: 'You’re being asked to fill out this form because your readiness score hasn’t improved since your last check-in.',
    next: 'If things haven’t turned around by next week, the next step is a meeting with your instructor and Student Success.',
  },
  step3: {
    eyebrow: 'Step 3 of 3',
    title: 'Meeting requested',
    explanation: 'We’ve asked your instructor and Student Success to set up a time to meet and talk through next steps together.',
    next: null,
  },
}

function StepTracker({ status }: { status: 'step1' | 'step2' | 'step3' }) {
  const currentIndex = STEPS.findIndex(s => s.key === status)
  return (
    <div className="flex items-center mb-5">
      {STEPS.map((s, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming'
        return (
          <div key={s.key} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
            <div className={`flex items-center gap-1.5 ${state === 'upcoming' ? 'opacity-50' : ''}`}>
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  state === 'current'
                    ? 'text-white'
                    : state === 'done'
                      ? 'bg-teal-primary/20 text-teal-primary'
                      : 'bg-border/50 text-muted-text'
                }`}
                style={state === 'current' ? { backgroundColor: '#6D2B5E' } : undefined}
              >
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span className={`text-xs font-semibold whitespace-nowrap ${state === 'current' ? 'text-dark-text' : 'text-muted-text'}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <span className={`flex-1 h-px mx-2 ${state === 'done' ? 'bg-teal-primary/40' : 'bg-border'}`} />}
          </div>
        )
      })}
    </div>
  )
}

export default function ReadinessTracker({ courseId, userName }: { courseId: string; userName: string }) {
  const [history, setHistory] = useState<ReadinessHistoryPoint[]>([])
  const [status, setStatus] = useState<EscalationStatus | null>(null)
  const [escalationHistory, setEscalationHistory] = useState<EscalationEventRecord[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [h, s, eh] = await Promise.all([
      getMyReadinessHistory(courseId),
      getMyEscalationStatus(courseId),
      getMyEscalationHistory(courseId),
    ])
    setHistory(h)
    setStatus(s?.status ?? 'none')
    setEscalationHistory(eh)
    setLoading(false)
  }, [courseId])

  useEffect(() => { load() }, [load])

  if (loading) return <p className="text-sm text-muted-text py-10 text-center">Loading…</p>

  // Whether the form for the *current* step1/step2 cycle has already been
  // submitted -- derived from real history (not local-only state) so it
  // survives a page refresh, unlike a plain "just submitted" flag.
  function hasCompletedCurrentCycle(step: 'step1' | 'step2'): boolean {
    const startedType = `${step}_started`
    const completedType = `${step}_completed`
    const lastStarted = [...escalationHistory].reverse().find(e => e.eventType === startedType)
    if (!lastStarted) return false
    return escalationHistory.some(e => e.eventType === completedType && e.createdAt >= lastStarted.createdAt)
  }

  const latest = history[history.length - 1] ?? null
  const alreadyCompletedCurrentStep = (status === 'step1' || status === 'step2') && hasCompletedCurrentCycle(status)
  const activeStep = (status === 'step1' || status === 'step2') && !alreadyCompletedCurrentStep ? status : null
  const processStep = (status === 'step1' || status === 'step2' || status === 'step3') ? status : null

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-dark-text mb-1">Weekly Readiness</h1>
        <p className="text-muted-text">Welcome back, <span className="font-semibold" style={{ color: '#6D2B5E' }}>{userName}</span></p>
      </div>

      <HowThisWorksSection audience="student" />

      <div className="bg-surface rounded-2xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-dark-text">This week</h2>
          <ReadinessZoneBadge zone={latest?.zone ?? null} />
        </div>

        {latest?.score != null ? (
          <>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-5xl font-bold" style={{ color: '#6D2B5E' }}>{latest.score.toFixed(1)}</span>
              <span className="text-muted-text text-sm">/ 5</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-5">
              <BreakdownStat label="Missing" value={String(latest.missing)} />
              <BreakdownStat label="Needs Revision" value={String(latest.needsRevision)} />
              <BreakdownStat label="Attendance missed" value={latest.attendancePctMissed != null ? `${Math.round(latest.attendancePctMissed)}%` : '—'} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-text mb-4">No score yet — check back after your first full week.</p>
        )}

        <ReadinessTrendChart history={history} />

        {escalationHistory.length > 0 && (
          <div className="mt-4">
            <EscalationHistorySection events={escalationHistory} />
          </div>
        )}
      </div>

      {processStep && (
        <div className="rounded-2xl border-2 border-teal-primary/40 overflow-hidden mb-6">
          <div className="bg-teal-light px-6 py-4">
            <StepTracker status={processStep} />
            <p className="text-xs font-bold uppercase tracking-wide text-teal-primary mb-1">{STEP_COPY[processStep].eyebrow}</p>
            <h3 className="text-lg font-bold text-dark-text">{STEP_COPY[processStep].title}</h3>
            {!alreadyCompletedCurrentStep && (
              <p className="text-sm text-dark-text/80 mt-1">{STEP_COPY[processStep].explanation}</p>
            )}
            {STEP_COPY[processStep].next && !alreadyCompletedCurrentStep && (
              <p className="text-xs text-dark-text/60 mt-2 italic">{STEP_COPY[processStep].next}</p>
            )}
          </div>
          {activeStep && (
            <div className="bg-surface p-6">
              <CheckinForm
                courseId={courseId}
                formType={activeStep === 'step1' ? 'acknowledgment' : 'reflection'}
                onSubmitted={load}
              />
            </div>
          )}
          {alreadyCompletedCurrentStep && (
            <div className="bg-surface p-6 text-center">
              <p className="font-semibold text-dark-text">Thanks — your check-in has been submitted. We&apos;ll follow up soon.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
