'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { HardwareDevice } from '@/lib/hardware'
import type { Person } from '@/lib/hardware-server'
import DeviceTable from './DeviceTable'

/** Most a single "selected" label link carries; bigger sets print via the filters instead. */
const MAX_SELECTED = 150

/**
 * The Devices list with checkboxes for printing labels: pick some, or print everything the
 * current filters show.
 */
export default function SelectableDevices({
  devices,
  people,
  emptyText,
  filterQuery,
}: {
  devices: HardwareDevice[]
  /** Holders, as a plain list (Maps can't be passed from a server component). */
  people: Person[]
  emptyText: string
  /** The current filters as a query string (kind/status/q), or '' when unfiltered. */
  filterQuery: string
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const peopleMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people])
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allSelected = devices.length > 0 && devices.every(d => selected.has(d.id))
  const ids = devices.filter(d => selected.has(d.id)).map(d => d.id)

  const btn = 'text-sm font-semibold px-4 py-1.5 rounded-full border border-border text-dark-text hover:bg-border/20'

  return (
    <>
      {devices.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <p className="text-xs text-muted-text">{devices.length} {devices.length === 1 ? 'device' : 'devices'}</p>
          <button type="button" onClick={() => setSelected(allSelected ? new Set() : new Set(devices.map(d => d.id)))} className="text-xs font-semibold text-teal-primary hover:underline">
            {allSelected ? 'Clear selection' : 'Select all'}
          </button>
          <div className="ml-auto flex flex-wrap gap-2">
            {ids.length > 0 && ids.length <= MAX_SELECTED && (
              <Link href={`/instructor/hardware/labels?ids=${ids.join(',')}`} className={btn}>
                Print labels for {ids.length} selected
              </Link>
            )}
            {ids.length > MAX_SELECTED && (
              <span className="text-xs text-muted-text self-center">Select {MAX_SELECTED} or fewer, or print all shown.</span>
            )}
            {filterQuery && (
              <Link href={`/instructor/hardware/labels?${filterQuery}`} className={btn}>
                Print labels for all {devices.length} shown
              </Link>
            )}
          </div>
        </div>
      )}
      <DeviceTable devices={devices} people={peopleMap} emptyText={emptyText} selected={selected} onToggle={toggle} />
    </>
  )
}
