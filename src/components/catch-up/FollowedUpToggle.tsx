'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setCatchUpFollowedUp } from '@/lib/class-catch-up-actions'

export default function FollowedUpToggle({ formId, studentName, initial }: { formId: string; studentName: string; initial: boolean }) {
  const router = useRouter()
  const [done, setDone] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle(next: boolean) {
    setBusy(true)
    setError(null)
    setDone(next)
    const res = await setCatchUpFollowedUp(formId, next)
    setBusy(false)
    if ('error' in res) { setDone(!next); setError(res.error); return }
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-2 text-sm font-semibold text-dark-text">
        <input type="checkbox" checked={done} disabled={busy} onChange={e => toggle(e.target.checked)} />
        Followed up<span className="sr-only"> with {studentName}</span>
      </label>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
