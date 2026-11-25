'use client'

import { useState } from 'react'
import type { HardwareDevice } from '@/lib/hardware'
import type { StudentNeeds } from '@/lib/hardware-shipping'
import ShipForm from './ShipForm'

/** "Ship…" that opens the ship form in place. */
export default function ShipButton(props: {
  studentId: string
  studentName: string
  needs: StudentNeeds
  inStock: HardwareDevice[]
  unshipped: HardwareDevice[]
  today: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-teal-primary hover:underline">
        {props.label ?? 'Ship…'}
      </button>
    )
  }
  return (
    <div className="basis-full">
      <ShipForm {...props} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
    </div>
  )
}
