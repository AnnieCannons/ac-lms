'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirmMyShipment } from '@/lib/hardware-shipping-actions'

/** A student telling us their box arrived. */
export default function IGotItButton({ shipmentId, disabled = false }: { shipmentId: string; disabled?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    const res = await confirmMyShipment(shipmentId)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    router.refresh()
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={confirm}
        disabled={busy || disabled}
        className="self-start bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'I got it'}
      </button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  )
}
