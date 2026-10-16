'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { checkHardwareBatch, createHardwarePurchaseBatch } from '@/lib/hardware-actions'
import {
  batchSize,
  CONDITION_LABELS,
  DEVICE_CONDITIONS,
  DEVICE_KINDS,
  KIND_LABELS,
  parseIdentifierList,
  validateBatchInput,
  type BatchInput,
  type DeviceKind,
} from '@/lib/hardware'
import { inputCls, labelCls } from './DeviceForm'

const IDENTIFIER_LABEL: Record<DeviceKind, string> = {
  laptop: 'Serial numbers',
  hotspot: 'IMEIs',
  booster: '',
}

const empty: BatchInput = {
  kind: 'laptop', purchasedOn: '', vendor: '', makeModel: '', modelYear: '', condition: 'refurbished',
  unitCost: '', warrantyEndsOn: '', notes: '', identifiers: '', count: '',
}

/**
 * Bulk-add one purchase. Shared details are entered once; laptops and hotspots take a pasted
 * list (one per line, or a spreadsheet column), boosters just a count. "Review" checks for
 * repeats and devices already in the tracker before anything is saved.
 */
export default function BatchForm() {
  const router = useRouter()
  const [form, setForm] = useState<BatchInput>(empty)
  const [review, setReview] = useState<{ count: number; alreadyAdded: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof BatchInput>(k: K, v: BatchInput[K]) => { setForm(f => ({ ...f, [k]: v })); setReview(null) }

  const isBooster = form.kind === 'booster'
  const parsed = parseIdentifierList(form.identifiers)

  async function onReview(e: React.FormEvent) {
    e.preventDefault()
    const invalid = validateBatchInput(form)
    if (invalid) { setError(invalid); return }
    setError(null)
    setBusy(true)
    const res = await checkHardwareBatch(form.kind, form.identifiers)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    setReview({ count: batchSize(form), alreadyAdded: res.alreadyAdded })
  }

  async function onSave() {
    setBusy(true)
    setError(null)
    const res = await createHardwarePurchaseBatch(form)
    if (!res.ok) { setBusy(false); setError(res.error); setReview(null); return }
    router.push(`/instructor/hardware/purchases/${res.batchId}`)
  }

  return (
    <form onSubmit={onReview} className="flex flex-col gap-6">
      <section className="bg-surface rounded-2xl border border-border p-6 flex flex-col gap-4">
        <h2 className="text-lg font-bold text-dark-text">Purchase details</h2>
        <p className="text-sm text-muted-text -mt-2">These apply to every device in the purchase. You can still change one device later.</p>
        <p className="text-xs text-muted-text -mt-2"><span className="text-red-600">*</span> Required</p>
        <fieldset>
          <legend className={labelCls}>Type</legend>
          <div className="flex flex-wrap gap-4 mt-2">
            {DEVICE_KINDS.map(k => (
              <label key={k} className="flex items-center gap-2 text-sm text-dark-text">
                <input type="radio" name="kind" value={k} checked={form.kind === k} onChange={() => set('kind', k)} />
                {KIND_LABELS[k]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className={labelCls}>
            Make and model<span className="text-red-600" aria-hidden="true"> *</span>
            <input className={`${inputCls} mt-1`} value={form.makeModel} onChange={e => set('makeModel', e.target.value)} placeholder="e.g. MacBook Pro 13-inch" required />
          </label>
          <label className={labelCls}>
            Year<span className="text-red-600" aria-hidden="true"> *</span>
            <input className={`${inputCls} mt-1`} value={form.modelYear} onChange={e => set('modelYear', e.target.value)} inputMode="numeric" placeholder="e.g. 2021" maxLength={4} required />
          </label>
          <label className={labelCls}>
            Condition<span className="text-red-600" aria-hidden="true"> *</span>
            <select className={`${inputCls} mt-1`} value={form.condition} onChange={e => set('condition', e.target.value as BatchInput['condition'])} required>
              <option value="">—</option>
              {DEVICE_CONDITIONS.map(c => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
            </select>
          </label>
          <label className={labelCls}>
            Vendor<span className="text-red-600" aria-hidden="true"> *</span>
            <input className={`${inputCls} mt-1`} value={form.vendor} onChange={e => set('vendor', e.target.value)} required />
          </label>
          <label className={labelCls}>
            Purchase date<span className="text-red-600" aria-hidden="true"> *</span>
            <input type="date" className={`${inputCls} mt-1`} value={form.purchasedOn} onChange={e => set('purchasedOn', e.target.value)} required />
          </label>
          <label className={labelCls}>
            Cost per device ($)<span className="text-red-600" aria-hidden="true"> *</span>
            <input className={`${inputCls} mt-1`} value={form.unitCost} onChange={e => set('unitCost', e.target.value)} inputMode="decimal" placeholder="e.g. 289.99" required />
          </label>
          <label className={labelCls}>
            Warranty ends
            <input type="date" className={`${inputCls} mt-1`} value={form.warrantyEndsOn} onChange={e => set('warrantyEndsOn', e.target.value)} />
          </label>
        </div>
        <label className={labelCls}>
          Notes
          <textarea className={`${inputCls} mt-1`} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </label>
      </section>

      <section className="bg-surface rounded-2xl border border-border p-6 flex flex-col gap-3">
        {isBooster ? (
          <label className={labelCls}>
            How many boosters?<span className="text-red-600" aria-hidden="true"> *</span>
            <input className={`${inputCls} mt-1 max-w-32`} value={form.count} onChange={e => set('count', e.target.value)} inputMode="numeric" required />
            <span className="block text-xs font-normal text-muted-text mt-1">Boosters have no serial number. Each one gets an LMS tag (BOOST-001…) to print on a label.</span>
          </label>
        ) : (
          <label className={labelCls}>
            {IDENTIFIER_LABEL[form.kind]}<span className="text-red-600" aria-hidden="true"> *</span>
            <span className="block text-xs font-normal text-muted-text mt-0.5">One per line. You can paste a column from a spreadsheet.</span>
            <textarea className={`${inputCls} mt-2 font-mono`} rows={10} value={form.identifiers} onChange={e => set('identifiers', e.target.value)} />
            <span className="block text-xs font-normal text-muted-text mt-1">
              {parsed.identifiers.length} {parsed.identifiers.length === 1 ? 'device' : 'devices'}
              {parsed.repeated.length > 0 && <span className="text-red-600"> · pasted more than once: {parsed.repeated.join(', ')}</span>}
            </span>
          </label>
        )}
      </section>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {review ? (
        <div role="status" className="bg-surface rounded-2xl border border-teal-primary p-6 flex flex-col gap-3">
          {review.alreadyAdded.length > 0 ? (
            <>
              <p className="text-sm font-semibold text-red-600">
                {review.alreadyAdded.length} already in the tracker, so nothing will be saved until they are removed from the list:
              </p>
              <p className="font-mono text-sm break-all">{review.alreadyAdded.join(', ')}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-dark-text">
                Ready to add <strong>{review.count} {KIND_LABELS[form.kind].toLowerCase()}{review.count === 1 ? '' : 's'}</strong>
                {form.makeModel.trim() ? <> ({[form.makeModel.trim(), form.modelYear.trim()].filter(Boolean).join(', ')})</> : null}.
                Each gets an LMS tag automatically.
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={onSave} disabled={busy} className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-60">
                  {busy ? 'Adding…' : `Add ${review.count}`}
                </button>
                <button type="button" onClick={() => setReview(null)} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
                  Back to editing
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div>
          <button type="submit" disabled={busy} className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-60">
            {busy ? 'Checking…' : 'Review'}
          </button>
        </div>
      )}
    </form>
  )
}
