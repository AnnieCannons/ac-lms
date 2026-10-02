'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import SkillTrendCard from '@/components/ui/SkillTrendCard'
import EmptySkillChart from '@/components/ui/EmptySkillChart'
import SkillMultiSelect from '@/components/ui/SkillMultiSelect'
import SetGoalForm from '@/components/ui/SetGoalForm'
import WhatHelpedForm from '@/components/ui/WhatHelpedForm'
import WhatHelpedPatterns from '@/components/ui/WhatHelpedPatterns'
import { reactivateConfidenceSkill } from '@/lib/confidence-trend-actions'
import { formatTimestamp, unansweredMetGoals, type SkillTrend, type UnansweredGoal } from '@/lib/confidence-trend'

// One titled section: a searchable multi-select over its skills and, beneath it, an empty
// chart until the student picks something, then a card (chart, goals, ratings) per pick.
function SkillSection({ id, title, description, selectLabel, placeholder, emptyChartMessage, noSkillsMessage, trends, selectedIds, onChange, renderFooter, renderGoalAction }: {
  id: string
  title: string
  description: string
  selectLabel: string
  placeholder: string
  emptyChartMessage: string
  noSkillsMessage: string
  trends: SkillTrend[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  renderFooter?: (trend: SkillTrend) => React.ReactNode
  renderGoalAction?: (trend: SkillTrend) => React.ReactNode
}) {
  const shown = trends.filter(t => selectedIds.includes(t.skillId))
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <h2 id={id} className="text-lg font-bold text-dark-text">{title}</h2>
          <span className="text-sm font-light text-muted-text">{trends.length} {trends.length === 1 ? 'skill' : 'skills'}</span>
        </div>
        <p className="mt-1 text-sm text-muted-text">{description}</p>
      </div>
      {trends.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-text">{noSkillsMessage}</p>
      ) : (
        <>
          <SkillMultiSelect
            label={selectLabel}
            placeholder={placeholder}
            options={trends.map(t => ({ id: t.skillId, name: t.name }))}
            selectedIds={selectedIds.filter(sid => trends.some(t => t.skillId === sid))}
            onChange={onChange}
          />
          {shown.length === 0
            ? <EmptySkillChart message={emptyChartMessage} />
            : <div className="space-y-5">{shown.map(t => <SkillTrendCard key={t.skillId} trend={t} goalAction={renderGoalAction?.(t)}>{renderFooter?.(t)}</SkillTrendCard>)}</div>}
        </>
      )}
    </section>
  )
}

type Tab = 'skills' | 'patterns'
const TABS: { id: Tab; label: string }[] = [
  { id: 'skills', label: 'Skills' },
  { id: 'patterns', label: 'Patterns' },
]

// `canReactivate` covers every student-only action on this page (reactivate, answer "what
// helped", set a goal): it is false for staff previewing the page, and the actions themselves
// also re-check on the server.
export default function SkillConfidenceView({ trends, canReactivate }: { trends: SkillTrend[]; canReactivate: boolean }) {
  const router = useRouter()
  const [answering, setAnswering] = useState<UnansweredGoal | null>(null)
  const [listing, setListing] = useState(false)
  // Goals answered from the list this visit, hidden at once instead of waiting for the refresh.
  const [answeredHere, setAnsweredHere] = useState<Set<string>>(new Set())
  const [settingGoal, setSettingGoal] = useState<SkillTrend | null>(null)
  const [activeSel, setActiveSel] = useState<string[]>([])
  const [masteredSel, setMasteredSel] = useState<string[]>([])
  const [confirming, setConfirming] = useState<SkillTrend | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>('skills')

  const active = trends.filter(t => !t.isMastered)
  const mastered = trends.filter(t => t.isMastered)
  const unanswered = unansweredMetGoals(trends)
  const waiting = unanswered.filter(u => !answeredHere.has(u.outcomeId))

  // Student-only follow-ups for one skill, shown in the card footer: an unanswered "what helped"
  // for a reached goal.
  const skillActions = (t: SkillTrend) => {
    const pendingAnswers = unanswered.filter(u => u.skillId === t.skillId)
    if (pendingAnswers.length === 0) return null
    return (
      <div className="mt-4 flex flex-col gap-2">
        {pendingAnswers.map(u => (
          <div key={u.outcomeId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-background px-3 py-2">
            <p className="text-sm text-dark-text">You reached your goal of {u.target} in {t.name}.</p>
            <button
              type="button"
              disabled={!canReactivate}
              onClick={() => setAnswering(u)}
              className="px-3 py-1 rounded-lg border border-teal-primary text-sm font-semibold text-teal-primary hover:bg-teal-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Log what helped
            </button>
          </div>
        ))}
        {!canReactivate && <p className="text-xs text-muted-text">Only the student can do this.</p>}
      </div>
    )
  }

  // "Set a goal" sits inside the goal panel, beside the goal status, when a goal can be set: none
  // yet, or the current one was reached.
  const goalAction = (t: SkillTrend) =>
    t.canSetGoal ? (
      <span className="inline-flex flex-col gap-1">
        <button
          type="button"
          disabled={!canReactivate}
          onClick={() => setSettingGoal(t)}
          className="px-4 py-1.5 rounded-lg border border-teal-primary text-sm font-semibold text-teal-primary hover:bg-teal-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Set a goal
        </button>
        {!canReactivate && <span className="text-xs text-muted-text">Only the student can do this.</span>}
      </span>
    ) : null

  const closeModal = () => { setConfirming(null); setError(null) }

  const confirmReactivate = () => {
    if (!confirming) return
    const skillId = confirming.skillId
    setError(null)
    startTransition(async () => {
      const result = await reactivateConfidenceSkill(skillId)
      if (result.error) {
        setError(result.error)
        return
      }
      // The skill moves to the working-on section; select it there so it doesn't vanish.
      setMasteredSel(prev => prev.filter(s => s !== skillId))
      setActiveSel(prev => (prev.includes(skillId) ? prev : [...prev, skillId]))
      closeModal()
      router.refresh()
    })
  }

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next: Tab = tab === 'skills' ? 'patterns' : 'skills'
    setTab(next)
    document.getElementById(`my-skill-tab-${next}`)?.focus()
  }

  const tablist = (
    <div role="tablist" aria-label="My Skill Confidence views" className="flex gap-1 border-b border-border" onKeyDown={onTabKeyDown}>
      {TABS.map(t => {
        const selected = tab === t.id
        return (
          <button
            key={t.id}
            id={`my-skill-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`my-skill-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={`-mb-px px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              selected ? 'border-teal-primary text-teal-primary' : 'border-transparent text-muted-text hover:text-dark-text'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )

  const patternsPanel = (
    <div role="tabpanel" id="my-skill-panel-patterns" aria-labelledby="my-skill-tab-patterns" className="pt-6">
      <WhatHelpedPatterns trends={trends} />
    </div>
  )

  if (trends.length === 0) {
    return (
      <div>
        {tablist}
        {tab === 'skills' ? (
          <div role="tabpanel" id="my-skill-panel-skills" aria-labelledby="my-skill-tab-skills" className="pt-6">
            <div className="bg-surface border-2 border-border rounded-2xl p-8 text-center">
              <p className="text-dark-text font-medium">No skill ratings yet</p>
              <p className="mt-1 text-sm text-muted-text">
                When you submit an assignment that has skills to rate, your ratings show up here so you can see how your confidence changes over time.
              </p>
            </div>
          </div>
        ) : patternsPanel}
      </div>
    )
  }

  return (
    <>
    <div className="space-y-12">
      {unanswered.length > 0 && (
        <section id="what-helped" aria-label="Goals waiting for a What helped answer" className="scroll-mt-6">
          <div className="flex w-fit max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-sm text-dark-text">
              {unanswered.length === 1 ? '1 reached goal is' : `${unanswered.length} reached goals are`} waiting for you to log what helped.
            </p>
            <button
              type="button"
              onClick={() => setListing(true)}
              className="px-3 py-1 rounded-lg border border-teal-primary text-sm font-semibold text-teal-primary hover:bg-teal-light transition-colors"
            >
              Log what helped
            </button>
          </div>
        </section>
      )}

      <div>
      {tablist}
      {tab === 'patterns' ? patternsPanel : (
      <div role="tabpanel" id="my-skill-panel-skills" aria-labelledby="my-skill-tab-skills" className="pt-6 space-y-12">
      <SkillSection
        id="skills-working-on"
        title="Skills you're working on"
        description="These are the skills you're growing right now. Pick the ones you want to see your progress and history for."
        selectLabel="Choose skills to view"
        placeholder="Search your skills…"
        emptyChartMessage="Select a skill above to see your progress and history."
        noSkillsMessage="You don't have any skills in progress right now."
        trends={active}
        selectedIds={activeSel}
        onChange={setActiveSel}
        renderFooter={skillActions}
        renderGoalAction={goalAction}
      />

      <SkillSection
        id="skills-mastered"
        title="Mastered skills"
        description="Skills you've rated a 10 twice, so they no longer appear on assignments. You can reactivate any of them to work on it again."
        selectLabel="Choose mastered skills to view"
        placeholder="Search mastered skills…"
        emptyChartMessage="Select a mastered skill above to see its history, or to reactivate it."
        noSkillsMessage="No mastered skills yet — keep going! A skill lands here once you rate it a 10 twice."
        trends={mastered}
        selectedIds={masteredSel}
        onChange={setMasteredSel}
        renderFooter={skillActions}
        renderGoalAction={t => (
          <span className="inline-flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setConfirming(t)}
              disabled={!canReactivate}
              className="px-4 py-1.5 rounded-lg border border-teal-primary text-sm font-semibold text-teal-primary hover:bg-teal-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reactivate
            </button>
            {!canReactivate && <span className="text-xs text-muted-text">Only the student can reactivate a skill.</span>}
          </span>
        )}
      />
      </div>
      )}
      </div>

    </div>

    {/* Dialogs sit outside the spaced container: its vertical-spacing margins would otherwise shrink the
        full-screen backdrop and leave a strip at the bottom of the page un-blurred. */}
      {listing && !answering && waiting.length > 0 && (
        <Modal title="Log what helped" onClose={() => setListing(false)} maxWidth="max-w-lg">
          <p className="text-sm text-muted-text">
            You reached {waiting.length === 1 ? 'a goal' : 'some goals'}! Log what helped to see your patterns build over time.
          </p>
          <ul className="mt-3 space-y-2">
            {waiting.map(u => (
              <li key={u.outcomeId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-border bg-surface px-4 py-3">
                <p className="text-sm text-dark-text">
                  {u.skillName}: you reached your goal of {u.target} on {formatTimestamp(u.metAt)}.
                </p>
                <button
                  type="button"
                  disabled={!canReactivate}
                  onClick={() => setAnswering(u)}
                  className="px-3 py-1 rounded-lg border border-teal-primary text-sm font-semibold text-teal-primary hover:bg-teal-light disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Log what helped
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {answering && (
        <Modal title={answering.skillName} onClose={() => setAnswering(null)} maxWidth="max-w-md">
          <WhatHelpedForm
            outcomeId={answering.outcomeId}
            skillName={answering.skillName}
            ownPlanText={answering.ownPlanText}
            onAnswered={() => {
              const answeredId = answering.outcomeId
              setAnsweredHere(prev => new Set(prev).add(answeredId))
              // Back to the list for any goals still waiting; close it if that was the last one.
              if (waiting.every(u => u.outcomeId === answeredId)) setListing(false)
              setAnswering(null)
              router.refresh()
            }}
            onSkip={() => setAnswering(null)}
          />
        </Modal>
      )}

      {settingGoal && settingGoal.latestRating != null && (
        <Modal title={`Set a goal for ${settingGoal.name}`} onClose={() => setSettingGoal(null)} maxWidth="max-w-md">
          <SetGoalForm
            skillId={settingGoal.skillId}
            skillName={settingGoal.name}
            rating={settingGoal.latestRating}
            cancelLabel="Cancel"
            onSaved={() => { setSettingGoal(null); router.refresh() }}
            onCancel={() => setSettingGoal(null)}
          />
        </Modal>
      )}

      {confirming && (
        <Modal title={`Reactivate ${confirming.name}?`} onClose={closeModal} maxWidth="max-w-md">
          <p className="text-sm text-dark-text">
            {confirming.name} will show up on your future assignments again, and you&apos;ll choose your current level and set a new goal. Your earlier ratings, goal, and the date you mastered it are kept.
          </p>
          {error && <p role="alert" className="mt-3 text-sm alert-error rounded-lg p-2">{error}</p>}
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-dark-text hover:bg-background">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmReactivate}
              disabled={pending}
              className="px-4 py-2 rounded-lg bg-teal-primary text-white text-sm font-semibold disabled:opacity-60"
            >
              {pending ? 'Reactivating…' : 'Reactivate'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
