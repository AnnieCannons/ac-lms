'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setStudentNeeds } from '@/lib/hardware-shipping-actions'
import { WIFI_CHOICES, WIFI_LABELS, type StudentNeeds, type WifiChoice } from '@/lib/hardware-shipping'

/**
 * The Wifi dropdown for one student (onboarding rows and the Hardware student page). Every
 * student gets a laptop, so there's no laptop choice; its status shows next to this.
 * Staff only; everyone else sees the choice as text.
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
  const [wifi, setWifi] = useState(needs.wifi)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canManage) {
    return <p className="text-sm text-dark-text">Wifi: <strong>{WIFI_LABELS[wifi]}</strong></p>
  }

  async function save(next: WifiChoice) {
    const previous = wifi
    setWifi(next)
    setBusy(true)
    setError(null)
    const res = await setStudentNeeds(studentId, { wifi: next })
    setBusy(false)
    if (!res.ok) { setWifi(previous); setError(res.error); return }
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex items-center gap-2 text-sm text-muted-text">
        Wifi
        <select
          className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-dark-text disabled:opacity-60"
          value={wifi}
          disabled={busy}
          aria-label={`Wifi for ${studentName}`}
          onChange={e => save(e.target.value as WifiChoice)}
        >
          {WIFI_CHOICES.map(w => <option key={w} value={w}>{WIFI_LABELS[w]}</option>)}
        </select>
      </label>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
