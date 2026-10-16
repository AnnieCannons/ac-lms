'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirmHardwareLost, markHardwareAwaitingReturn, markHardwarePrepped } from '@/lib/hardware-actions'

const btn = 'text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-dark-text hover:bg-border/20 disabled:opacity-60 whitespace-nowrap'

function useRun() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (!res.ok) setError(res.error ?? 'Something went wrong.')
    else router.refresh()
  }
  return { busy, error, run }
}

const ErrorText = ({ error }: { error: string | null }) => (error ? <span role="alert" className="block text-xs text-red-600 mt-1">{error}</span> : null)

/** Needs prep list: wiped and checked, back in stock. */
export function PreppedButton({ deviceId }: { deviceId: string }) {
  const { busy, error, run } = useRun()
  return (
    <>
      <button type="button" disabled={busy} className={btn} onClick={() => run(() => markHardwarePrepped(deviceId))}>
        {busy ? 'Saving…' : 'Wiped and checked'}
      </button>
      <ErrorText error={error} />
    </>
  )
}

/** Awaiting return list: confirm a likely-lost device is gone. */
export function ConfirmLostButton({ deviceId, tag }: { deviceId: string; tag: string }) {
  const { busy, error, run } = useRun()
  return (
    <>
      <button
        type="button"
        disabled={busy}
        className={btn}
        onClick={() => { if (window.confirm(`Mark ${tag} as lost?`)) run(() => confirmHardwareLost(deviceId, 'Not returned after 60 days')) }}
      >
        {busy ? 'Saving…' : 'Confirm lost'}
      </button>
      <ErrorText error={error} />
    </>
  )
}

/** Student page: mark everything they have on loan as awaiting return in one click. */
export function MarkAllAwaitingButton({ deviceIds, name }: { deviceIds: string[]; name: string }) {
  const { busy, error, run } = useRun()
  return (
    <>
      <button
        type="button"
        disabled={busy}
        className="bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90 disabled:opacity-60"
        onClick={() => { if (window.confirm(`Mark everything ${name} has on loan as awaiting return?`)) run(() => markHardwareAwaitingReturn(deviceIds, '')) }}
      >
        {busy ? 'Saving…' : `Mark ${deviceIds.length === 1 ? 'it' : `all ${deviceIds.length}`} awaiting return`}
      </button>
      <ErrorText error={error} />
    </>
  )
}
