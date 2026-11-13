import Link from 'next/link'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareViewer } from '@/lib/hardware-access'
import { DEVICE_COLUMNS, loadOpenReturns, searchStudents } from '@/lib/hardware-server'
import { daysSince, isLikelyLost, KIND_LABELS, RECEIVE_STATUSES, STATUS_LABELS, type HardwareDevice, type ReceiveStatus } from '@/lib/hardware'
import HardwareShell from '@/components/hardware/HardwareShell'
import Card from '@/components/hardware/Card'
import ReceiveFlow from '@/components/hardware/ReceiveFlow'

const inputCls = 'px-3 py-2 rounded-lg border border-border bg-background text-dark-text text-sm focus:outline-none focus:border-teal-primary'
const secondaryBtn = 'text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20'
const UUID = /^[0-9a-f-]{36}$/i

/**
 * "A box arrived": find the student by name, tick what came back, done.
 * After saving, `done` (device ids) and `next` (their new status) in the URL show the confirmation.
 */
export default async function ReceivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; student?: string; done?: string; next?: string }>
}) {
  const viewer = await getHardwareViewer()
  const { q = '', student: studentId, done, next } = await searchParams
  const admin = createServiceSupabaseClient()

  let student: { id: string; name: string | null; email: string } | null = null
  let devices: HardwareDevice[] = []
  if (studentId && UUID.test(studentId)) {
    const { data } = await admin.from('users').select('id, name, email').eq('id', studentId).maybeSingle()
    student = data
    if (student) {
      const { data: rows } = await admin.from('hardware_devices').select(DEVICE_COLUMNS)
        .eq('current_holder_id', student.id).neq('status', 'owned_by_student').order('asset_tag')
      devices = (rows as HardwareDevice[] | null) ?? []
    }
  }
  const matches = !student && q ? await searchStudents(admin, q) : []

  // Who we've asked for something back: the most likely senders, oldest request first.
  const expected = new Map<string, { id: string; name: string; email: string; items: string[]; days: number; lost: boolean }>()
  if (!student) {
    for (const r of await loadOpenReturns(admin)) {
      if (!r.student) continue
      const entry = expected.get(r.student.id) ?? {
        id: r.student.id, name: r.student.name ?? r.student.email, email: r.student.email, items: [], days: 0, lost: false,
      }
      entry.items.push(`${r.device.asset_tag} (${KIND_LABELS[r.device.kind].toLowerCase()})`)
      entry.days = Math.max(entry.days, daysSince(r.request.requested_at))
      entry.lost = entry.lost || isLikelyLost(r.request.requested_at)
      expected.set(r.student.id, entry)
    }
  }

  // The confirmation after saving.
  const doneIds = (done ?? '').split(',').filter(id => UUID.test(id)).slice(0, 50)
  const { data: doneRows } = doneIds.length
    ? await admin.from('hardware_devices').select(DEVICE_COLUMNS).in('id', doneIds)
    : { data: [] }
  const received = (doneRows as HardwareDevice[] | null) ?? []
  const nextStatus = RECEIVE_STATUSES.includes(next as ReceiveStatus) ? (next as ReceiveStatus) : null
  const studentName = student ? (student.name ?? student.email) : ''

  return (
    <HardwareShell viewer={viewer} active="receive" breadcrumbs={[{ label: 'Hardware', href: '/instructor/hardware' }, { label: 'Mark received' }]}>
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Mark received</h1>
          <p className="text-sm text-muted-text mt-1">When equipment arrives back: find who sent it, then tick what was in the box.</p>
        </div>

        {received.length > 0 && student && (
          <div role="status" className="bg-surface rounded-2xl border border-teal-primary p-5 flex flex-col gap-3">
            <p className="text-base font-bold text-dark-text">
              <span aria-hidden="true">✓ </span>
              Received {received.map(d => d.asset_tag).join(', ')} from {studentName}
            </p>
            {nextStatus && (
              <p className="text-sm text-muted-text">
                {received.length === 1 ? 'It is' : 'They are'} now <strong className="text-dark-text">{STATUS_LABELS[nextStatus]}</strong>
                {nextStatus === 'needs_prep' ? ', and listed under Needs attention until wiped and checked.' : '.'}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href="/instructor/hardware/receive" className="bg-teal-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:opacity-90">
                Mark something else received
              </Link>
              {received.map(d => (
                <Link key={d.id} href={`/instructor/hardware/devices/${d.id}`} className={secondaryBtn}>View {d.asset_tag}</Link>
              ))}
              <Link href={`/instructor/hardware/students/${student.id}`} className={secondaryBtn}>View {studentName}&apos;s hardware</Link>
            </div>
          </div>
        )}

        {!student ? (
          <Card title="Who sent it?">
            <form method="get" className="flex flex-wrap items-end gap-3" role="search">
              <label className="text-xs font-semibold text-muted-text flex flex-col gap-1">
                Student name or email
                <input name="q" defaultValue={q} autoFocus className={`${inputCls} w-72 max-w-full`} />
              </label>
              <button type="submit" className={secondaryBtn}>Find</button>
            </form>
            {q && (
              <div className="mt-4">
                {matches.length === 0 ? <p className="text-sm text-muted-text">No students match &ldquo;{q}&rdquo;.</p> : (
                  <ul className="flex flex-col divide-y divide-border">
                    {matches.map(p => (
                      <li key={p.id} className="py-2.5 first:pt-0 last:pb-0">
                        <Link href={`/instructor/hardware/receive?student=${p.id}`} className="text-sm font-medium text-dark-text hover:text-teal-primary">
                          {p.name ?? p.email} <span className="font-normal text-muted-text">· {p.email}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>
        ) : received.length === 0 && (
          <Card
            title={devices.length ? `What came back from ${studentName}?` : studentName}
            action={<Link href="/instructor/hardware/receive" className="text-sm font-semibold text-teal-primary hover:underline">Choose a different student</Link>}
          >
            {devices.length > 0 ? (
              <ReceiveFlow studentId={student.id} devices={devices} />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-dark-text">{studentName} has nothing on loan right now, so there&apos;s nothing to mark received.</p>
                <p className="text-sm text-muted-text">
                  If a box arrived from them anyway, check their hardware page. The device may already be marked received, or it may be one they own.
                </p>
                <div>
                  <Link href={`/instructor/hardware/students/${student.id}`} className={secondaryBtn}>View {studentName}&apos;s hardware</Link>
                </div>
              </div>
            )}
          </Card>
        )}

        {!student && (
          <Card title={`We're waiting on · ${expected.size}`}>
            {expected.size === 0 ? (
              <p className="text-sm text-muted-text">No one right now. Students show up here once their equipment is marked awaiting return.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {[...expected.values()].map(e => (
                  <li key={e.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link href={`/instructor/hardware/receive?student=${e.id}`} className="group flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
                      <span className="font-medium text-dark-text group-hover:text-teal-primary">{e.name}</span>
                      <span className="text-muted-text">{e.items.join(', ')}</span>
                      <span className={`ml-auto whitespace-nowrap ${e.lost ? 'text-red-600 font-semibold' : 'text-muted-text'}`}>
                        {e.days} {e.days === 1 ? 'day' : 'days'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {student && received.length > 0 && devices.length > 0 && (
          <Card title={`Still with ${studentName}`}>
            <p className="text-sm text-muted-text mb-3">{devices.map(d => `${d.asset_tag} (${KIND_LABELS[d.kind]})`).join(', ')}</p>
            <ReceiveFlow studentId={student.id} devices={devices} />
          </Card>
        )}
      </div>
    </HardwareShell>
  )
}
