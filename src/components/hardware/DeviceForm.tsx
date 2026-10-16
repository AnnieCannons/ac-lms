'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createHardwareDevice, updateHardwareDevice } from '@/lib/hardware-actions'
import {
  CONDITION_LABELS,
  DEVICE_CONDITIONS,
  DEVICE_KINDS,
  KIND_LABELS,
  validateDeviceInput,
  type DeviceInput,
} from '@/lib/hardware'

export const inputCls = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-dark-text text-sm focus:outline-none focus:border-teal-primary'
export const labelCls = 'block text-sm font-semibold text-dark-text'

/** Add a single device (deviceId null) or edit one. The type is fixed once a device exists. */
export default function DeviceForm({
  deviceId,
  initial,
  onCancel,
  onSaved,
  bare = false,
}: {
  deviceId: string | null
  initial: DeviceInput
  onCancel?: () => void
  onSaved?: () => void
  /** Drop the form's own card styling when it sits inside another card. */
  bare?: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState<DeviceInput>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const set = <K extends keyof DeviceInput>(k: K, v: DeviceInput[K]) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const invalid = validateDeviceInput(form)
    if (invalid) { setError(invalid); return }
    setSaving(true)
    setError(null)
    const res = deviceId ? await updateHardwareDevice(deviceId, form) : await createHardwareDevice(form)
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    if (!deviceId && 'id' in res) { router.push(`/instructor/hardware/devices/${res.id}`); return }
    setSaved(true)
    onSaved?.()
    router.refresh()
  }

  const isLaptop = form.kind === 'laptop'
  const isHotspot = form.kind === 'hotspot'

  return (
    <form onSubmit={onSubmit} className={bare ? 'flex flex-col gap-4' : 'bg-surface rounded-2xl border border-border p-6 flex flex-col gap-4'}>
      {!deviceId && (
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
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <label className={labelCls}>
          Serial number{isLaptop && <span className="text-red-600" aria-hidden="true"> *</span>}
          <input className={`${inputCls} mt-1 font-mono`} value={form.serialNumber} onChange={e => set('serialNumber', e.target.value)} required={isLaptop} />
        </label>
        {isHotspot && (
          <>
            <label className={labelCls}>
              IMEI
              <input className={`${inputCls} mt-1 font-mono`} value={form.imei} onChange={e => set('imei', e.target.value)} inputMode="numeric" />
            </label>
            <label className={labelCls}>
              Phone number
              <input className={`${inputCls} mt-1`} value={form.phoneNumber} onChange={e => set('phoneNumber', e.target.value)} type="tel" />
            </label>
            <label className={labelCls}>
              ICCID (SIM number)
              <input className={`${inputCls} mt-1 font-mono`} value={form.iccid} onChange={e => set('iccid', e.target.value)} inputMode="numeric" />
            </label>
          </>
        )}
        <label className={labelCls}>
          Make and model
          <input className={`${inputCls} mt-1`} value={form.makeModel} onChange={e => set('makeModel', e.target.value)} placeholder={isLaptop ? 'e.g. MacBook Pro 13-inch' : ''} />
        </label>
        <label className={labelCls}>
          Year
          <input className={`${inputCls} mt-1`} value={form.modelYear} onChange={e => set('modelYear', e.target.value)} inputMode="numeric" placeholder="2021" maxLength={4} />
        </label>
        <label className={labelCls}>
          Condition
          <select className={`${inputCls} mt-1`} value={form.condition} onChange={e => set('condition', e.target.value as DeviceInput['condition'])}>
            <option value="">—</option>
            {DEVICE_CONDITIONS.map(c => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
          </select>
        </label>
      </div>
      {isHotspot && <p className="text-xs text-muted-text -mt-2">A hotspot needs an IMEI or a phone number.</p>}

      <label className={labelCls}>
        Notes
        <textarea className={`${inputCls} mt-1`} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </label>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 disabled:opacity-60">
          {saving ? 'Saving…' : deviceId ? 'Save changes' : 'Add device'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
            Cancel
          </button>
        )}
        {saved && <span role="status" className="text-sm text-muted-text">Saved.</span>}
      </div>
    </form>
  )
}
