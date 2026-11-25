'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setStudentNeeds } from '@/lib/hardware-shipping-actions'
import {
  LAPTOP_NEEDS,
  LAPTOP_NEED_LABELS,
  WIFI_CHOICES,
  WIFI_LABELS,
  type LaptopNeed,
  type StudentNeeds,
  type WifiChoice,
} from '@/lib/hardware-shipping'

/**
 * The Laptop and Wifi dropdowns for one student (onboarding rows and the Hardware student
 * page). Staff only; everyone else sees the choices as text.
 */
export default function NeedsControls({
  studentId,
  needs,
  canManage,
  studentName,
}: {
  studentId: string
  needs: StudentNeeds
  canManage: boolean
  studentName: string
}) {
  const router = useRouter()
  const [value, setValue] = useState(needs)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canManage) {
    return (
      <p className="text-sm text-dark-text">
        Laptop: <strong>{LAPTOP_NEED_LABELS[value.laptop]}</strong> · Wifi: <strong>{WIFI_LABELS[value.wifi]}</strong>
      </p>
    )
  }

  async function save(change: Partial<StudentNeeds>) {
    const previous = value
    setValue({ ...value, ...change })
    setBusy(true)
    setError(null)
    const res = await setStudentNeeds(studentId, change)
    setBusy(false)
    if (!res.ok) { setValue(previous); setError(res.error); return }
    router.refresh()
  }

  const selectCls = 'border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-dark-text disabled:opacity-60'
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex items-center gap-2 text-sm text-muted-text">
        Laptop
        <select
          className={selectCls}
          value={value.laptop}
          disabled={busy}
          aria-label={`Laptop for ${studentName}`}
          onChange={e => save({ laptop: e.target.value as LaptopNeed })}
        >
          {LAPTOP_NEEDS.map(n => <option key={n} value={n}>{LAPTOP_NEED_LABELS[n]}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-muted-text">
        Wifi
        <select
          className={selectCls}
          value={value.wifi}
          disabled={busy}
          aria-label={`Wifi for ${studentName}`}
          onChange={e => save({ wifi: e.target.value as WifiChoice })}
        >
          {WIFI_CHOICES.map(w => <option key={w} value={w}>{WIFI_LABELS[w]}</option>)}
        </select>
      </label>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
