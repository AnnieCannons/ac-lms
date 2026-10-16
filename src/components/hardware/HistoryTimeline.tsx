import Link from 'next/link'
import { EVENT_LABELS, formatPacific, type HardwareDevice, type HardwareEvent } from '@/lib/hardware'
import type { Person } from '@/lib/hardware-server'

/** Newest-first history. On a student page, `devices` names the device each entry is about. */
export default function HistoryTimeline({
  events,
  people,
  devices,
}: {
  events: HardwareEvent[]
  people: Map<string, Person>
  devices?: Map<string, HardwareDevice>
}) {
  if (events.length === 0) return <p className="text-sm text-muted-text">Nothing yet.</p>
  return (
    <ol className="flex flex-col gap-3">
      {events.map(e => {
        const actor = e.actor_id ? people.get(e.actor_id) : null
        const student = !devices && e.student_id ? people.get(e.student_id) : null
        const device = devices && e.device_id ? devices.get(e.device_id) : null
        return (
          <li key={e.id} className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
              <span className="font-semibold text-dark-text">{EVENT_LABELS[e.type] ?? e.type}</span>
              {device && (
                <Link href={`/instructor/hardware/devices/${device.id}`} className="text-teal-primary hover:underline">{device.asset_tag}</Link>
              )}
              {student && (
                <Link href={`/instructor/hardware/students/${student.id}`} className="text-teal-primary hover:underline">{student.name ?? student.email}</Link>
              )}
              <span className="text-xs text-muted-text ml-auto">
                {formatPacific(e.created_at)}{actor ? ` · ${actor.name ?? actor.email}` : ''}
              </span>
            </div>
            {e.notes && <p className="text-sm text-dark-text mt-1 whitespace-pre-line">{e.notes}</p>}
          </li>
        )
      })}
    </ol>
  )
}
