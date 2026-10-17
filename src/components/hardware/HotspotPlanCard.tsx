'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteHardwareSubscription, saveHardwareSubscription } from '@/lib/hardware-actions'
import { formatDateOnly } from '@/lib/hardware'
import {
  daysBetween,
  RENEWAL_ALERT_DAYS,
  renewalOf,
  renewalState,
  validateSubscriptionInput,
  type Subscription,
  type SubscriptionInput,
} from '@/lib/hardware-reminders'
import Card from './Card'
import { inputCls, labelCls } from './DeviceForm'

const linkBtn = 'text-sm font-semibold text-teal-primary hover:underline'

function toInput(s: Subscription): SubscriptionInput {
  return {
    carrier: s.carrier, plan: s.plan ?? '', startsOn: s.starts_on, endsOn: s.ends_on, cost: s.cost != null ? String(s.cost) : '',
    accountNumber: s.account_number ?? '', lineNumber: s.line_number ?? '', notes: s.notes ?? '',
  }
}

/** A hotspot's plan: current period, renewal countdown, past periods; add / renew / edit. */
export default function HotspotPlanCard({ deviceId, subscriptions, today, readOnly = false }: { deviceId: string; subscriptions: Subscription[]; today: string; readOnly?: boolean }) {
  const router = useRouter()
  const current = subscriptions[0] ?? null
  const past = subscriptions.slice(1)
  const [editing, setEditing] = useState<{ id: string | null; input: SubscriptionInput } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const blank = (): SubscriptionInput => {
    const end = new Date(`${today}T00:00:00Z`)
    end.setUTCFullYear(end.getUTCFullYear() + 1)
    return { carrier: 'Mission Telecom', plan: '', startsOn: today, endsOn: end.toISOString().slice(0, 10), cost: '', accountNumber: '', lineNumber: '', notes: '' }
  }
  const set = <K extends keyof SubscriptionInput>(k: K, v: string) => setEditing(e => (e ? { ...e, input: { ...e.input, [k]: v } } : e))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    const invalid = validateSubscriptionInput(editing.input)
    if (invalid) { setError(invalid); return }
    setBusy(true)
    setError(null)
    const res = await saveHardwareSubscription(deviceId, editing.id, editing.input)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    setEditing(null)
    router.refresh()
  }

  async function remove(id: string) {
    if (!window.confirm('Remove this plan period?')) return
    const res = await deleteHardwareSubscription(id)
    if (!res.ok) { setError(res.error); return }
    setEditing(null)
    router.refresh()
  }

  const action = !readOnly && !editing && (
    <div className="flex gap-4">
      {current && <button type="button" className={linkBtn} onClick={() => { setEditing({ id: null, input: renewalOf(current) }); setError(null) }}>Renew</button>}
      {current && <button type="button" className={linkBtn} onClick={() => { setEditing({ id: current.id, input: toInput(current) }); setError(null) }}>Edit</button>}
      {!current && <button type="button" className={linkBtn} onClick={() => { setEditing({ id: null, input: blank() }); setError(null) }}>Add plan</button>}
    </div>
  )

  const state = current ? renewalState(current.ends_on, today) : null
  const left = current ? daysBetween(today, current.ends_on) : 0

  return (
    <Card title="Plan" action={action}>
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className={labelCls}>Through<input className={`${inputCls} mt-1`} value={editing.input.carrier} onChange={e => set('carrier', e.target.value)} required /></label>
            <label className={labelCls}>Plan (optional)<input className={`${inputCls} mt-1`} value={editing.input.plan} onChange={e => set('plan', e.target.value)} placeholder="e.g. Unlimited, 1 year" /></label>
            <label className={labelCls}>Starts<input type="date" className={`${inputCls} mt-1`} value={editing.input.startsOn} onChange={e => set('startsOn', e.target.value)} required /></label>
            <label className={labelCls}>Ends<input type="date" className={`${inputCls} mt-1`} value={editing.input.endsOn} onChange={e => set('endsOn', e.target.value)} required /></label>
            <label className={labelCls}>Cost ($, optional)<input className={`${inputCls} mt-1`} value={editing.input.cost} onChange={e => set('cost', e.target.value)} inputMode="decimal" /></label>
            <label className={labelCls}>Account number (optional)<input className={`${inputCls} mt-1`} value={editing.input.accountNumber} onChange={e => set('accountNumber', e.target.value)} /></label>
            <label className={labelCls}>Line number (optional)<input className={`${inputCls} mt-1`} value={editing.input.lineNumber} onChange={e => set('lineNumber', e.target.value)} /></label>
          </div>
          <label className={labelCls}>Notes (optional)<input className={`${inputCls} mt-1`} value={editing.input.notes} onChange={e => set('notes', e.target.value)} /></label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60">{busy ? 'Saving…' : 'Save plan'}</button>
            <button type="button" onClick={() => { setEditing(null); setError(null) }} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">Cancel</button>
            {editing.id && <button type="button" onClick={() => remove(editing.id!)} className="ml-auto text-sm font-semibold text-muted-text hover:text-red-600 px-2">Remove this plan</button>}
          </div>
        </form>
      ) : !current ? (
        <p className="text-sm text-muted-text">No plan recorded.{readOnly ? '' : ` Add one so you get a reminder ${RENEWAL_ALERT_DAYS} days before it needs renewing.`}</p>
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <p className={state === 'ok' ? 'text-dark-text' : 'text-red-600 font-semibold'}>
            {state === 'expired' ? `Ended ${-left} ${left === -1 ? 'day' : 'days'} ago. Renew it, or remove the hotspot from use.`
              : state === 'due' ? `Renews in ${left} ${left === 1 ? 'day' : 'days'} (${formatDateOnly(current.ends_on)}).`
              : `Good until ${formatDateOnly(current.ends_on)} (${left} days).`}
          </p>
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
            {([
              ['Through', [current.carrier, current.plan].filter(Boolean).join(' · ')],
              ['Period', `${formatDateOnly(current.starts_on)} – ${formatDateOnly(current.ends_on)}`],
              ['Cost', current.cost != null ? `$${Number(current.cost).toFixed(2)}` : null],
              ['Account / line', [current.account_number, current.line_number].filter(Boolean).join(' · ') || null],
            ] as [string, string | null][]).map(([k, v]) => (
              <div key={k}><dt className="text-xs font-semibold text-muted-text">{k}</dt><dd className="mt-0.5 text-dark-text">{v || <span className="text-muted-text">—</span>}</dd></div>
            ))}
          </dl>
          {current.notes && <p className="text-muted-text whitespace-pre-line">{current.notes}</p>}
          {past.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-text mb-1">Earlier periods</p>
              <ul className="flex flex-col gap-0.5 text-xs text-muted-text">
                {past.map(p => <li key={p.id}>{formatDateOnly(p.starts_on)} – {formatDateOnly(p.ends_on)}{p.plan ? ` · ${p.plan}` : ''}{p.cost != null ? ` · $${Number(p.cost).toFixed(2)}` : ''}</li>)}
              </ul>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Card>
  )
}
