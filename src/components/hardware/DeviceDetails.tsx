'use client'

import { useState } from 'react'
import Link from 'next/link'
import { deviceToInput, formatDateOnly, type HardwareDevice } from '@/lib/hardware'
import type { PurchaseBatch } from '@/lib/hardware-server'
import DeviceForm from './DeviceForm'
import Card from './Card'

/**
 * Identifiers and purchase info, read-only. Model, year and condition are in the page
 * header; "Edit" opens the form for all of them.
 */
export default function DeviceDetails({ device, batch, canEdit = true }: { device: HardwareDevice; batch: PurchaseBatch | null; canEdit?: boolean }) {
  const [editing, setEditing] = useState(false)

  const editLink = canEdit && !editing && (
    <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-teal-primary hover:underline">
      Edit
    </button>
  )

  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: 'Serial number', value: device.serial_number, mono: true },
    ...(device.kind === 'hotspot'
      ? [
          { label: 'IMEI', value: device.imei, mono: true },
          { label: 'Phone number', value: device.phone_number },
          { label: 'ICCID (SIM)', value: device.iccid, mono: true },
        ]
      : []),
    {
      label: 'Purchased',
      value: batch ? (
        <Link href={`/instructor/hardware/purchases/${batch.id}`} className="text-teal-primary hover:underline">
          {[formatDateOnly(batch.purchased_on), batch.vendor].filter(Boolean).join(' · ') || 'View purchase'}
        </Link>
      ) : null,
    },
    { label: 'Cost', value: batch?.unit_cost != null ? `$${Number(batch.unit_cost).toFixed(2)}` : null },
    { label: 'Warranty until', value: batch?.warranty_ends_on ? formatDateOnly(batch.warranty_ends_on) : null },
  ]

  return (
    <Card title="Details" action={editLink}>
      {editing ? (
        <DeviceForm bare deviceId={device.id} initial={deviceToInput(device)} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          {rows.map(({ label, value, mono }) => (
            <div key={label}>
              <dt className="text-xs font-semibold text-muted-text">{label}</dt>
              <dd className={`mt-0.5 text-dark-text break-all ${mono ? 'font-mono' : ''}`}>{value || <span className="text-muted-text">—</span>}</dd>
            </div>
          ))}
          {device.notes && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold text-muted-text">Notes</dt>
              <dd className="mt-0.5 text-dark-text whitespace-pre-line">{device.notes}</dd>
            </div>
          )}
        </dl>
      )}
    </Card>
  )
}
