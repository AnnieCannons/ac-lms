import Link from 'next/link'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareViewer } from '@/lib/hardware-access'
import { loadCheckins } from '@/lib/hardware-checkin-server'
import { formatPacific } from '@/lib/hardware'
import HardwareShell from '@/components/hardware/HardwareShell'
import Card from '@/components/hardware/Card'

/** Equipment check-ins sent to students, newest first. */
export default async function CheckinListPage() {
  const viewer = await getHardwareViewer({ manage: true })
  const checkins = await loadCheckins(createServiceSupabaseClient())

  return (
    <HardwareShell viewer={viewer} active="checkin" breadcrumbs={[{ label: 'Hardware', href: '/instructor/hardware' }, { label: 'Check-in' }]}>
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-dark-text">Equipment check-in</h1>
            <p className="text-sm text-muted-text mt-1">Ask students which equipment they have, then review their answers to fill in the tracker.</p>
          </div>
          <Link href="/instructor/hardware/check-in/new" className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90">
            + Send a check-in
          </Link>
        </div>
        <Card title={`Check-ins · ${checkins.length}`}>
          {checkins.length === 0 ? (
            <p className="text-sm text-muted-text">None sent yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {checkins.map(c => (
                <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                  <Link href={`/instructor/hardware/check-in/${c.id}`} className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                    <span className="font-semibold text-dark-text group-hover:text-teal-primary">{c.title}</span>
                    {c.closed_at && <span className="text-[11px] font-semibold border border-border rounded-full px-2 py-0.5 text-muted-text">Closed</span>}
                    <span className="text-muted-text">Sent {formatPacific(c.created_at)}</span>
                    <span className="ml-auto text-muted-text whitespace-nowrap">
                      {c.answered} of {c.sent} answered
                      {c.toReview > 0 && <span className="text-dark-text font-semibold"> · {c.toReview} to review</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </HardwareShell>
  )
}
