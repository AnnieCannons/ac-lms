'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { endInternetPlan, saveInternetPlan } from '@/lib/hardware-shipping-actions'
import { formatDateOnly } from '@/lib/hardware'
import { isPlanCurrent, nextRenewal, ordinalDay, type InternetPlan, type InternetPlanInput } from '@/lib/hardware-shipping'
import { inputCls, labelCls } from './DeviceForm'
import Card from './Card'

const money = (n: number | null) => (n === null ? null : `$${Number(n).toFixed(2)}/month`)

function PlanForm({ studentId, plan, today, onDone }: { studentId: string; plan: InternetPlan | null; today: string; onDone: () => void }) {
  const router = useRouter()
  const [input, setInput] = useState<InternetPlanInput>({
    accountNumber: plan?.account_number ?? '',
    monthlyCost: plan?.monthly_cost !== null && plan?.monthly_cost !== undefined ? String(plan.monthly_cost) : '',
    startsOn: plan?.starts_on ?? today,
    endsOn: plan?.ends_on ?? '',
    notes: plan?.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof InternetPlanInput) => (e: React.ChangeEvent<HTMLInputElement>) => setInput(i => ({ ...i, [k]: e.target.value }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await saveInternetPlan(studentId, plan?.id ?? null, input)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
    onDone()
  }

  return (
    <form onSubmit={save} className="mt-3 bg-background rounded-xl border border-border p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className={labelCls}>Started on (billing day)
        <input type="date" className={`${inputCls} mt-1`} value={input.startsOn} onChange={set('startsOn')} required />
      </label>
      <label className={labelCls}>Monthly cost
        <input className={`${inputCls} mt-1`} value={input.monthlyCost} onChange={set('monthlyCost')} placeholder="e.g. 30.00" inputMode="decimal" />
      </label>
      <label className={labelCls}>Account number
        <input className={`${inputCls} mt-1`} value={input.accountNumber} onChange={set('accountNumber')} />
      </label>
      {plan && (
        <label className={labelCls}>Ended on
          <input type="date" className={`${inputCls} mt-1`} value={input.endsOn} onChange={set('endsOn')} />
        </label>
      )}
      <label className={`${labelCls} sm:col-span-2`}>Note
        <input className={`${inputCls} mt-1`} value={input.notes} onChange={set('notes')} />
      </label>
      {error && <p role="alert" className="sm:col-span-2 text-sm text-red-600">{error}</p>}
      <div className="sm:col-span-2 flex gap-2">
        <button type="submit" disabled={busy} className="bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60">{busy ? 'Saving…' : plan ? 'Save' : 'Add plan'}</button>
        <button type="button" onClick={onDone} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">Cancel</button>
      </div>
    </form>
  )
}

/**
 * Comcast NOW plans AnnieCannons pays for. A reminder posts in #student-hardware on each
 * monthly billing day so the receipt gets submitted.
 */
export default function InternetPlanCard({
  studentId,
  plans,
  today,
  canManage,
}: {
  studentId: string
  plans: InternetPlan[]
  today: string
  canManage: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = plans.filter(p => isPlanCurrent(p, today))
  const past = plans.filter(p => !isPlanCurrent(p, today))

  async function end(plan: InternetPlan) {
    if (!window.confirm('End this Comcast NOW plan today? Monthly reminders stop.')) return
    setError(null)
    const res = await endInternetPlan(plan.id)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
  }

  const action = canManage && current.length === 0 && editing !== 'new'
    ? <button type="button" onClick={() => setEditing('new')} className="text-sm font-semibold text-teal-primary hover:underline">Set up plan</button>
    : undefined

  return (
    <Card title="Comcast NOW" action={action}>
      {error && <p role="alert" className="text-sm text-red-600 mb-3">{error}</p>}
      {current.length === 0 && editing !== 'new' && (
        <p className="text-sm text-muted-text">No plan recorded yet. Add it once it&apos;s set up so the monthly receipt reminder starts.</p>
      )}
      <ul className="flex flex-col divide-y divide-border">
        {current.map(p => {
          const next = nextRenewal(p, today)
          return (
            <li key={p.id} className="py-3 first:pt-0 last:pb-0 text-sm">
              <p className="text-dark-text">
                <strong>{p.provider}</strong> since {formatDateOnly(p.starts_on)}
                {money(p.monthly_cost) && <> · {money(p.monthly_cost)}</>}
                {p.account_number && <> · account {p.account_number}</>}
              </p>
              <p className="text-xs text-muted-text mt-0.5">
                Bills monthly on the {ordinalDay(p.starts_on)}{next && <> · next {formatDateOnly(next)}</>}
                {p.ends_on && <> · ends {formatDateOnly(p.ends_on)}</>}
              </p>
              {p.notes && <p className="text-xs text-muted-text mt-0.5">{p.notes}</p>}
              {canManage && editing !== p.id && (
                <div className="flex gap-4 mt-1">
                  <button type="button" onClick={() => setEditing(p.id)} className="text-xs font-semibold text-teal-primary hover:underline">Edit</button>
                  {!p.ends_on && <button type="button" onClick={() => end(p)} className="text-xs font-semibold text-teal-primary hover:underline">End plan</button>}
                </div>
              )}
              {editing === p.id && <PlanForm studentId={studentId} plan={p} today={today} onDone={() => setEditing(null)} />}
            </li>
          )
        })}
      </ul>
      {editing === 'new' && <PlanForm studentId={studentId} plan={null} today={today} onDone={() => setEditing(null)} />}
      {past.length > 0 && (
        <p className="text-xs text-muted-text mt-3">
          Earlier: {past.map(p => `${formatDateOnly(p.starts_on)} – ${formatDateOnly(p.ends_on)}`).join('; ')}
        </p>
      )}
    </Card>
  )
}
