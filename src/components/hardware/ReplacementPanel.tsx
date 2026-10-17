'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordHardwareReplacement } from '@/lib/hardware-actions'
import {
  formatPacific,
  REPLACEMENT_LIMIT,
  validateReplacementInput,
  WRITE_OFF_LABELS,
  WRITE_OFF_STATUSES,
  type HardwareDevice,
  type ReplacementInput,
  type ReplacementKind,
} from '@/lib/hardware'
import type { Replacement } from '@/lib/hardware-server'
import Card from './Card'
import { inputCls, labelCls } from './DeviceForm'

const label = (d: HardwareDevice) => [d.asset_tag, d.make_model, d.model_year].filter(Boolean).join(' · ')

/**
 * Replacements used (one laptop, one charger) and the form to record a new one. For a laptop
 * you pick which in-stock laptop to send and whether the old one is coming back.
 */
export default function ReplacementPanel({
  studentId,
  replacements,
  studentLaptops,
  inStockLaptops,
  deviceTags,
  readOnly = false,
}: {
  /** TAs see what's been used but can't record replacements. */
  readOnly?: boolean
  studentId: string
  replacements: Replacement[]
  studentLaptops: HardwareDevice[]
  inStockLaptops: HardwareDevice[]
  deviceTags: Record<string, string>
}) {
  const router = useRouter()
  const [kind, setKind] = useState<ReplacementKind | null>(null)
  const [form, setForm] = useState<ReplacementInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const used = (k: ReplacementKind) => replacements.filter(r => r.kind === k).length

  function open(k: ReplacementKind) {
    setKind(k)
    setError(null)
    setForm({
      studentId, kind: k,
      oldDeviceId: studentLaptops.length === 1 ? studentLaptops[0].id : null,
      newDeviceId: null, oldComingBack: true, writeOff: '', writeOffReason: '', overrideNote: '', notes: '',
    })
  }
  const close = () => { setKind(null); setForm(null); setError(null) }
  const set = <K extends keyof ReplacementInput>(k: K, v: ReplacementInput[K]) => setForm(f => (f ? { ...f, [k]: v } : f))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form || !kind) return
    const invalid = validateReplacementInput(form, used(kind))
    if (invalid) { setError(invalid); return }
    setBusy(true)
    setError(null)
    const res = await recordHardwareReplacement(form)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    close()
    router.refresh()
  }

  const counter = (k: ReplacementKind, name: string) => {
    const n = used(k)
    return (
      <span className={n >= REPLACEMENT_LIMIT ? 'font-semibold text-dark-text' : 'text-muted-text'}>
        {name}: {n} of {REPLACEMENT_LIMIT} used
      </span>
    )
  }

  const action = !readOnly && !kind && (
    <div className="flex gap-3">
      <button type="button" onClick={() => open('laptop')} disabled={studentLaptops.length === 0} className="text-sm font-semibold text-teal-primary hover:underline disabled:text-muted-text disabled:no-underline" title={studentLaptops.length === 0 ? 'This student has no laptop to replace' : undefined}>
        Replace laptop
      </button>
      <button type="button" onClick={() => open('charger')} className="text-sm font-semibold text-teal-primary hover:underline">
        Replace charger
      </button>
    </div>
  )

  return (
    <Card title="Replacements" action={action}>
      <p className="text-sm flex flex-wrap gap-x-6 gap-y-1">
        {counter('laptop', 'Laptop')}
        {counter('charger', 'Charger')}
      </p>

      {replacements.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {replacements.map(r => (
            <li key={r.id} className="text-muted-text">
              <span className="text-dark-text font-medium">{r.kind === 'laptop' ? 'Laptop' : 'Charger'}</span>
              {' · '}{formatPacific(r.created_at)}
              {r.kind === 'laptop' && r.old_device_id && r.new_device_id && ` · ${deviceTags[r.old_device_id] ?? 'old'} → ${deviceTags[r.new_device_id] ?? 'new'}`}
              {' · '}{r.old_coming_back ? 'old one coming back' : `written off: ${r.write_off_reason}`}
              {r.override_note && ` · extra: ${r.override_note}`}
            </li>
          ))}
        </ul>
      )}

      {kind && form && (
        <form onSubmit={save} className="mt-4 bg-background rounded-xl border border-border p-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-dark-text">Replace {kind}</h3>

          {kind === 'laptop' ? (
            <>
              <label className={labelCls}>
                Laptop being replaced
                <select className={`${inputCls} mt-1`} value={form.oldDeviceId ?? ''} onChange={e => set('oldDeviceId', e.target.value || null)}>
                  <option value="">Choose…</option>
                  {studentLaptops.map(d => <option key={d.id} value={d.id}>{label(d)}</option>)}
                </select>
              </label>
              <label className={labelCls}>
                Laptop to send
                <select className={`${inputCls} mt-1`} value={form.newDeviceId ?? ''} onChange={e => set('newDeviceId', e.target.value || null)}>
                  <option value="">{inStockLaptops.length ? 'Choose an in-stock laptop…' : 'No laptops in stock'}</option>
                  {inStockLaptops.map(d => <option key={d.id} value={d.id}>{label(d)}</option>)}
                </select>
              </label>
            </>
          ) : studentLaptops.length > 1 && (
            <label className={labelCls}>
              For which laptop (optional)
              <select className={`${inputCls} mt-1`} value={form.oldDeviceId ?? ''} onChange={e => set('oldDeviceId', e.target.value || null)}>
                <option value="">—</option>
                {studentLaptops.map(d => <option key={d.id} value={d.id}>{label(d)}</option>)}
              </select>
            </label>
          )}

          <fieldset>
            <legend className={labelCls}>The old one</legend>
            <div className="flex flex-col gap-2 mt-2">
              <label className="flex items-center gap-2 text-sm text-dark-text">
                <input type="radio" name="old" checked={form.oldComingBack} onChange={() => set('oldComingBack', true)} />
                Is being sent back{kind === 'laptop' ? ' (we chase it and it shows as awaiting return)' : ''}
              </label>
              <label className="flex items-center gap-2 text-sm text-dark-text">
                <input type="radio" name="old" checked={!form.oldComingBack} onChange={() => set('oldComingBack', false)} />
                Isn&apos;t coming back
              </label>
            </div>
          </fieldset>

          {!form.oldComingBack && (
            <>
              {kind === 'laptop' && (
                <label className={labelCls}>
                  Why
                  <select className={`${inputCls} mt-1`} value={form.writeOff} onChange={e => set('writeOff', e.target.value as ReplacementInput['writeOff'])}>
                    <option value="">Choose…</option>
                    {WRITE_OFF_STATUSES.map(w => <option key={w} value={w}>{WRITE_OFF_LABELS[w]}</option>)}
                  </select>
                </label>
              )}
              <label className={labelCls}>
                What happened
                <input className={`${inputCls} mt-1`} value={form.writeOffReason} onChange={e => set('writeOffReason', e.target.value)} placeholder="e.g. stolen from car, police report filed" />
              </label>
            </>
          )}

          {used(kind) >= REPLACEMENT_LIMIT && (
            <label className={labelCls}>
              <span className="text-red-600">Already used their {kind} replacement.</span> Why is this one allowed?
              <input className={`${inputCls} mt-1`} value={form.overrideNote} onChange={e => set('overrideNote', e.target.value)} />
            </label>
          )}

          <label className={labelCls}>
            Note (optional)
            <input className={`${inputCls} mt-1`} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="e.g. tracking number" />
          </label>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60">
              {busy ? 'Saving…' : 'Record replacement'}
            </button>
            <button type="button" onClick={close} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
              Cancel
            </button>
          </div>
        </form>
      )}
    </Card>
  )
}
