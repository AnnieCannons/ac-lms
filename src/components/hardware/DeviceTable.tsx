import Link from 'next/link'
import { KIND_LABELS, primaryIdentifier, type HardwareDevice } from '@/lib/hardware'
import type { Person } from '@/lib/hardware-server'
import StatusBadge from './StatusBadge'

export default function DeviceTable({
  devices,
  people,
  emptyText = 'No devices.',
  showHolder = true,
  selected,
  onToggle,
}: {
  devices: HardwareDevice[]
  people: Map<string, Person>
  emptyText?: string
  showHolder?: boolean
  /** With onToggle: adds a checkbox column (used for printing labels). */
  selected?: Set<string>
  onToggle?: (id: string) => void
}) {
  const selectable = !!selected && !!onToggle
  if (devices.length === 0) return <p className="text-sm text-muted-text">{emptyText}</p>
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface text-muted-text text-xs uppercase tracking-wide">
          <tr>
            {selectable && <th scope="col" className="w-10 px-4 py-2"><span className="sr-only">Select</span></th>}
            <th scope="col" className="text-left px-4 py-2 font-semibold">Tag</th>
            <th scope="col" className="text-left px-3 py-2 font-semibold">Type</th>
            <th scope="col" className="text-left px-3 py-2 font-semibold">Serial / IMEI</th>
            <th scope="col" className="text-left px-3 py-2 font-semibold">Model</th>
            <th scope="col" className="text-left px-3 py-2 font-semibold">Status</th>
            {showHolder && <th scope="col" className="text-left px-3 py-2 font-semibold">With</th>}
          </tr>
        </thead>
        <tbody>
          {devices.map(d => {
            const holder = d.current_holder_id ? people.get(d.current_holder_id) : null
            return (
              <tr key={d.id} className="border-t border-border">
                {selectable && (
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-teal-primary"
                      checked={selected!.has(d.id)}
                      onChange={() => onToggle!(d.id)}
                      aria-label={`Select ${d.asset_tag}`}
                    />
                  </td>
                )}
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link href={`/instructor/hardware/devices/${d.id}`} className="font-semibold text-dark-text hover:text-teal-primary">
                    {d.asset_tag ?? '—'}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-muted-text">{KIND_LABELS[d.kind]}</td>
                <td className="px-3 py-2.5 font-mono text-xs break-all">{primaryIdentifier(d) ?? <span className="text-muted-text">—</span>}</td>
                <td className="px-3 py-2.5 text-muted-text">{[d.make_model, d.model_year].filter(Boolean).join(' · ') || '—'}</td>
                <td className="px-3 py-2.5"><StatusBadge status={d.status} /></td>
                {showHolder && (
                  <td className="px-3 py-2.5">
                    {holder ? (
                      <Link href={`/instructor/hardware/students/${holder.id}`} className="text-dark-text hover:text-teal-primary">
                        {holder.name ?? holder.email}
                      </Link>
                    ) : <span className="text-muted-text">—</span>}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
