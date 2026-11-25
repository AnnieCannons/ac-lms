import Link from 'next/link'
import { KIND_LABELS, formatDateOnly } from '@/lib/hardware'
import { CARRIER_LABELS, trackingUrl, type EquipmentState } from '@/lib/hardware-shipping'
import { pacificShortDate } from '@/lib/onboarding'

/** One student's equipment on the onboarding page: what they have, what's on its way, what's left to ship. */
export default function EquipmentStatusList({ states, studentId }: { states: EquipmentState[]; studentId: string }) {
  if (states.length === 0) return <p className="text-xs text-muted-text">Nothing to ship.</p>
  return (
    <ul className="flex flex-col gap-1 text-xs">
      {states.map((s, i) => {
        if (s.kind === 'comcast_now') {
          return (
            <li key={`comcast-${i}`}>
              <span className="font-semibold text-dark-text">Comcast NOW: </span>
              {s.state === 'set_up' && <span className="text-green-700">set up</span>}
              {s.state === 'to_set_up' && (
                <Link href={`/instructor/hardware/students/${studentId}`} className="font-semibold text-amber-700 underline">record the plan</Link>
              )}
              {s.state === 'after_finish' && <span className="text-muted-text">once they finish</span>}
            </li>
          )
        }
        const label = KIND_LABELS[s.kind]
        if (s.state === 'held') {
          const ship = s.shipment
          const url = ship ? trackingUrl(ship.carrier, ship.tracking_number) : null
          return (
            <li key={s.device.id}>
              <span className="font-semibold text-dark-text">{label} </span>
              <span className="font-mono text-muted-text">{s.device.asset_tag}</span>
              {' · '}
              {!ship && <span className="text-muted-text">{s.device.status === 'owned_by_student' ? 'theirs' : s.device.status === 'awaiting_return' ? 'awaiting return' : 'on loan, not shipped'}</span>}
              {ship?.received_at && <span className="text-green-700">arrived {pacificShortDate(ship.received_at)}</span>}
              {ship && !ship.received_at && (
                <span className="text-dark-text">
                  shipped {formatDateOnly(ship.shipped_on)} ·{' '}
                  {url
                    ? <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono text-teal-primary hover:underline">{CARRIER_LABELS[ship.carrier]} {ship.tracking_number}<span className="sr-only"> (opens in a new tab)</span></a>
                    : <span className="font-mono">{CARRIER_LABELS[ship.carrier]} {ship.tracking_number}</span>}
                </span>
              )}
            </li>
          )
        }
        return (
          <li key={`${s.kind}-${i}`}>
            <span className="font-semibold text-dark-text">{label}: </span>
            {s.state === 'to_ship'
              ? <span className="font-semibold text-amber-700">ready to ship</span>
              : <span className="text-muted-text">ships once they finish</span>}
          </li>
        )
      })}
    </ul>
  )
}
