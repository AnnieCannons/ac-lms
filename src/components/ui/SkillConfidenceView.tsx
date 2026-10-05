'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import SkillTrendCard from '@/components/ui/SkillTrendCard'
import EmptySkillChart from '@/components/ui/EmptySkillChart'
import SkillMultiSelect from '@/components/ui/SkillMultiSelect'
import SetGoalForm from '@/components/ui/SetGoalForm'
import WhatHelpedForm from '@/components/ui/WhatHelpedForm'
import WhatHelpedPatterns from '@/components/ui/WhatHelpedPatterns'
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

// `canEdit` covers every student-only action on this page (answer "what helped", set a goal):
// it is false for staff previewing the page, and the actions themselves also re-check on the server.
export default function SkillConfidenceView({ trends, canEdit }: { trends: SkillTrend[]; canEdit: boolean }) {
  const router = useRouter()
  const [answering, setAnswering] = useState<UnansweredGoal | null>(null)
  const [listing, setListing] = useState(false)
  // Goals answered from the list this visit, hidden at once instead of waiting for the refresh.
  const [answeredHere, setAnsweredHere] = useState<Set<string>>(new Set())
  const [settingGoal, setSettingGoal] = useState<SkillTrend | null>(null)
  const [growingSel, setGrowingSel] = useState<string[]>([])
  const [maintainingSel, setMaintainingSel] = useState<string[]>([])
  const [tab, setTab] = useState<Tab>('skills')

  // Growing: the latest rating is below 10. Maintaining: it is 10. A new rating moves a skill either way.
  const growing = trends.filter(t => !t.isMaintaining)
  const maintaining = trends.filter(t => t.isMaintaining)
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
            <p className="text-sm text-dark-text">
              {u.target != null ? `You reached your goal of ${u.target} in ${t.name}.` : `You got to 10 in ${t.name}.`}
            </p>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => setAnswering(u)}
              className="px-3 py-1 rounded-lg border border-teal-primary text-sm font-semibold text-teal-primary hover:bg-teal-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Log what helped
            </button>
          </div>
        ))}
        {!canEdit && <p className="text-xs text-muted-text">Only the student can do this.</p>}
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
          disabled={!canEdit}
          onClick={() => setSettingGoal(t)}
          className="px-4 py-1.5 rounded-lg border border-teal-primary text-sm font-semibold text-teal-primary hover:bg-teal-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Set a goal
        </button>
        {!canEdit && <span className="text-xs text-muted-text">Only the student can do this.</span>}
      </span>
    ) : null

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
        id="skills-growing"
        title="Skills you're growing"
        description="Skills you've rated below 10. Pick the ones you want to see your progress and history for."
        selectLabel="Choose skills to view"
        placeholder="Search your skills…"
        emptyChartMessage="Select a skill above to see your progress and history."
        noSkillsMessage="You don't have any skills you're growing right now."
        trends={growing}
        selectedIds={growingSel}
        onChange={setGrowingSel}
        renderFooter={skillActions}
        renderGoalAction={goalAction}
      />

      <SkillSection
        id="skills-maintaining"
        title="Skills you're maintaining"
        description="Skills you've rated a 10. They still show up on assignments, already at 10, and you can pick a lower rating any time if it no longer feels like a 10. Picking a lower rating moves the skill to Skills you're growing."
        selectLabel="Choose maintained skills to view"
        placeholder="Search maintained skills…"
        emptyChartMessage="Select a skill above to see its history."
        noSkillsMessage="No skills here yet — a skill lands here once you rate it a 10."
        trends={maintaining}
        selectedIds={maintainingSel}
        onChange={setMaintainingSel}
        renderFooter={skillActions}
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
                  {u.target != null
                    ? `${u.skillName}: you reached your goal of ${u.target} on ${formatTimestamp(u.metAt)}.`
                    : `${u.skillName}: you got to 10 on ${formatTimestamp(u.metAt)}.`}
                </p>
                <button
                  type="button"
                  disabled={!canEdit}
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

    </>
  )
}
