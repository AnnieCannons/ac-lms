'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  addHardwareCheckinRecipients,
  approveHardwareCheckinResponse,
  dismissHardwareCheckinResponse,
  nudgeHardwareCheckin,
  reopenHardwareCheckinResponse,
  setHardwareCheckinClosed,
  type ApproveChoices,
} from '@/lib/hardware-checkin-actions'
import type { CheckinPlan, CheckinResponse, PlanStep } from '@/lib/hardware-checkin'
import type { Person } from '@/lib/hardware-server'
import StudentPicker from './StudentPicker'
import { inputCls } from './DeviceForm'

const primaryBtn = 'bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60'
const secondaryBtn = 'text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20 disabled:opacity-60'
const smallBtn = 'text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-dark-text hover:bg-border/20 disabled:opacity-60 whitespace-nowrap'

function useRun() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'Something went wrong.'); return }
    after?.()
    router.refresh()
  }
  return { busy, error, run }
}

const actionable = (s: PlanStep) => s.action === 'create' || s.action === 'link'

/** One line of what approving would do for laptop / hotspot / booster. */
function StepLine({ label, step, detail, checked, onToggle }: {
  label: string; step: PlanStep; detail: string; checked: boolean; onToggle: () => void
}) {
  if (step.action === 'none') return null
  const deviceLink = 'device' in step && (
    <Link href={`/instructor/hardware/devices/${step.device.id}`} className="text-teal-primary hover:underline">{step.device.asset_tag}</Link>
  )
  return (
    <li className="text-sm">
      {actionable(step) ? (
        <label className="flex items-start gap-2 text-dark-text">
          <input type="checkbox" className="h-4 w-4 mt-0.5 accent-teal-primary" checked={checked} onChange={onToggle} />
          <span>
            <strong>{label}:</strong> {step.action === 'create' ? <>add a new {label.toLowerCase()} {detail} and give it to them</> : <>give them {deviceLink} (in stock) {detail}</>}
          </span>
        </label>
      ) : step.action === 'already' ? (
        <p className="text-muted-text pl-6"><strong className="text-dark-text">{label}:</strong> already recorded as theirs ({deviceLink}).</p>
      ) : step.action === 'conflict' ? (
        <p className="text-red-600 pl-6"><strong>{label}:</strong> {detail} matches {deviceLink}. {step.reason} Sort it out on the device page, then approve.</p>
      ) : null}
    </li>
  )
}

/** A response waiting for review: what the student said, what approving would do. */
export function ReviewCard({ response: r, student, plan }: { response: CheckinResponse; student: Person; plan: CheckinPlan }) {
  const { busy, error, run } = useRun()
  const [choices, setChoices] = useState<ApproveChoices>({
    laptop: actionable(plan.laptop), hotspot: actionable(plan.hotspot), booster: actionable(plan.booster),
    replacements: plan.laptopReplacement || plan.chargerReplacement, laptopOwned: false,
  })
  const [dismissing, setDismissing] = useState(false)
  const [dismissNote, setDismissNote] = useState('')
  const flip = (k: keyof ApproveChoices) => setChoices(c => ({ ...c, [k]: !c[k] }))

  const said = [
    r.has_laptop ? `Laptop ${r.laptop_serial ?? ''}`.trim() : 'No laptop',
    r.has_hotspot ? `Hotspot ${[r.hotspot_imei && `IMEI ${r.hotspot_imei}`, r.hotspot_phone].filter(Boolean).join(' · ')}` : 'No hotspot',
    r.has_booster ? 'Booster' : 'No booster',
    ...(r.laptop_replaced ? ['Laptop was replaced before'] : []),
    ...(r.charger_replaced ? ['Charger was replaced before'] : []),
  ]
  const pastReplacements = [plan.laptopReplacement && 'laptop', plan.chargerReplacement && 'charger'].filter(Boolean).join(' and ')
  const nothingToDo = !actionable(plan.laptop) && !actionable(plan.hotspot) && !actionable(plan.booster) && !pastReplacements

  return (
    <li className="py-4 first:pt-0 last:pb-0 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <Link href={`/instructor/hardware/students/${student.id}`} className="font-semibold text-dark-text hover:text-teal-primary">{student.name ?? student.email}</Link>
        <span className="text-xs text-muted-text">{student.email}</span>
      </div>
      <p className="text-sm text-muted-text"><span className="font-semibold text-dark-text">They said: </span>{said.join(' · ')}</p>
      {r.notes && <p className="text-sm text-dark-text whitespace-pre-line border-l-2 border-border pl-3">{r.notes}</p>}

      <ul className="flex flex-col gap-1.5">
        <StepLine label="Laptop" step={plan.laptop} detail={r.laptop_serial ? `(serial ${r.laptop_serial})` : ''} checked={choices.laptop} onToggle={() => flip('laptop')} />
        <StepLine label="Hotspot" step={plan.hotspot} detail={r.hotspot_imei ? `(IMEI ${r.hotspot_imei})` : r.hotspot_phone ? `(${r.hotspot_phone})` : ''} checked={choices.hotspot} onToggle={() => flip('hotspot')} />
        <StepLine label="Booster" step={plan.booster} detail="with the next BOOST- tag" checked={choices.booster} onToggle={() => flip('booster')} />
        {pastReplacements && (
          <li className="text-sm">
            <label className="flex items-start gap-2 text-dark-text">
              <input type="checkbox" className="h-4 w-4 mt-0.5 accent-teal-primary" checked={choices.replacements} onChange={() => flip('replacements')} />
              <span><strong>Past replacement:</strong> record that their {pastReplacements} was already replaced (counts toward their one each)</span>
            </label>
          </li>
        )}
        {nothingToDo && <li className="text-sm text-muted-text">Nothing to add to the tracker.</li>}
      </ul>

      {actionable(plan.laptop) && choices.laptop && (
        <fieldset className="text-sm">
          <legend className="sr-only">Their laptop is</legend>
          <div className="flex flex-wrap gap-4 pl-6">
            <label className="flex items-center gap-2"><input type="radio" checked={!choices.laptopOwned} onChange={() => setChoices(c => ({ ...c, laptopOwned: false }))} /> Laptop is on loan</label>
            <label className="flex items-center gap-2"><input type="radio" checked={choices.laptopOwned} onChange={() => setChoices(c => ({ ...c, laptopOwned: true }))} /> Laptop is already theirs</label>
          </div>
        </fieldset>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {dismissing ? (
        <form className="flex flex-wrap items-center gap-2" onSubmit={e => { e.preventDefault(); run(() => dismissHardwareCheckinResponse(r.id, dismissNote)) }}>
          <label className="sr-only" htmlFor={`dismiss-${r.id}`}>Why dismiss</label>
          <input id={`dismiss-${r.id}`} className={`${inputCls} max-w-sm`} value={dismissNote} onChange={e => setDismissNote(e.target.value)} placeholder="Why (optional), e.g. duplicate" autoFocus />
          <button type="submit" disabled={busy} className={secondaryBtn}>Dismiss</button>
          <button type="button" onClick={() => setDismissing(false)} className="text-sm font-semibold text-muted-text hover:text-dark-text px-2">Cancel</button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => run(() => approveHardwareCheckinResponse(r.id, choices))} className={primaryBtn}>
            {busy ? 'Saving…' : nothingToDo ? 'Mark reviewed' : 'Approve'}
          </button>
          <button type="button" disabled={busy} onClick={() => setDismissing(true)} className={secondaryBtn}>Dismiss</button>
        </div>
      )}
    </li>
  )
}

export function NudgeButton({ surveyId, userIds, label }: { surveyId: string; userIds?: string[]; label: string }) {
  const { busy, error, run } = useRun()
  const [done, setDone] = useState(false)
  return (
    <>
      <button type="button" disabled={busy || done} className={smallBtn} onClick={() => run(() => nudgeHardwareCheckin(surveyId, userIds), () => setDone(true))}>
        {busy ? 'Sending…' : done ? 'Reminded' : label}
      </button>
      {error && <span role="alert" className="text-xs text-red-600 ml-2">{error}</span>}
    </>
  )
}

export function ReopenButton({ responseId }: { responseId: string }) {
  const { busy, error, run } = useRun()
  return (
    <>
      <button type="button" disabled={busy} className={smallBtn} onClick={() => run(() => reopenHardwareCheckinResponse(responseId))}>Review again</button>
      {error && <span role="alert" className="text-xs text-red-600 ml-2">{error}</span>}
    </>
  )
}

export function CloseToggle({ surveyId, closed }: { surveyId: string; closed: boolean }) {
  const { busy, error, run } = useRun()
  return (
    <>
      <button
        type="button"
        disabled={busy}
        className={secondaryBtn}
        onClick={() => { if (closed || window.confirm('Close this check-in? Students who haven\'t answered will stop seeing it.')) run(() => setHardwareCheckinClosed(surveyId, !closed)) }}
      >
        {closed ? 'Reopen check-in' : 'Close check-in'}
      </button>
      {error && <span role="alert" className="text-xs text-red-600 ml-2">{error}</span>}
    </>
  )
}

/** Add more students to an open check-in, one by one. */
export function AddPeople({ surveyId }: { surveyId: string }) {
  const { busy, error, run } = useRun()
  const [open, setOpen] = useState(false)
  const [people, setPeople] = useState<Person[]>([])
  const [added, setAdded] = useState<number | null>(null)
  if (!open) return <button type="button" onClick={() => { setOpen(true); setAdded(null) }} className={secondaryBtn}>Add people</button>
  return (
    <div className="basis-full bg-background rounded-xl border border-border p-4 flex flex-col gap-3">
      <StudentPicker label="Add a student" value={null} onChange={p => { if (p && !people.some(x => x.id === p.id)) setPeople(l => [...l, p]) }} />
      {people.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {people.map(p => (
            <li key={p.id} className="flex items-center gap-2 text-sm border border-border rounded-full pl-3 pr-1 py-1">
              {p.name ?? p.email}
              <button type="button" onClick={() => setPeople(l => l.filter(x => x.id !== p.id))} aria-label={`Remove ${p.name ?? p.email}`} className="text-muted-text hover:text-red-600 px-1.5">✕</button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {added != null && <p role="status" className="text-sm text-muted-text">Sent to {added} more {added === 1 ? 'student' : 'students'}.</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || people.length === 0}
          className={primaryBtn}
          onClick={() => run(async () => {
            const res = await addHardwareCheckinRecipients(surveyId, [], people.map(p => p.id))
            if (res.ok) { setAdded(res.added); setPeople([]) }
            return res
          })}
        >
          Send to {people.length || ''} {people.length === 1 ? 'student' : 'students'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={secondaryBtn}>Done</button>
      </div>
    </div>
  )
}
