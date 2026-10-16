import Link from 'next/link'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareViewer } from '@/lib/hardware-access'
import { loadDevices, loadHolders, loadHotspotPlans, loadOpenReturns, loadPeople, loadReadyToTransfer, loadWaitlist, searchStudents } from '@/lib/hardware-server'
import { daysBetween, pacificToday, RENEWAL_ALERT_DAYS, renewalState } from '@/lib/hardware-reminders'
import { loadOpenTickets } from '@/lib/hardware-tickets-server'
import { TICKET_STATUS_LABELS, ticketNeedsNudge } from '@/lib/hardware-tickets'
import {
  DEVICE_KINDS,
  DEVICE_STATUSES,
  daysSince,
  isLikelyLost,
  KIND_LABELS,
  LIKELY_LOST_DAYS,
  STATUS_LABELS,
  type DeviceKind,
  type DeviceStatus,
  type HardwareDevice,
} from '@/lib/hardware'
import type { Person } from '@/lib/hardware-server'
import HardwareShell from '@/components/hardware/HardwareShell'
import Card from '@/components/hardware/Card'
import { ConfirmLostButton, PreppedButton, TransferButton } from '@/components/hardware/AttentionButtons'
import WaitlistManager from '@/components/hardware/WaitlistManager'
import SelectableDevices from '@/components/hardware/SelectableDevices'

const TABS = {
  devices: { title: 'Devices', subtitle: 'Every laptop, hotspot and wifi booster.' },
  students: { title: 'Students', subtitle: 'Find a student to see or update their equipment.' },
  attention: { title: 'Needs attention', subtitle: 'Things waiting on you.' },
  waitlist: { title: 'Waitlist', subtitle: 'Students waiting for a device, first come, first served.' },
} as const
type Tab = keyof typeof TABS

const inputCls = 'px-3 py-2 rounded-lg border border-border bg-background text-dark-text text-sm focus:outline-none focus:border-teal-primary'

/** One line in a Needs attention card: device on the left, student in the middle, action on the right. */
function AttentionRow({ device, student, meta, metaTone, action }: {
  device: HardwareDevice
  student?: Person | null
  meta?: string
  metaTone?: 'urgent'
  action?: React.ReactNode
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0 text-sm">
      <div className="min-w-0 sm:w-56">
        <Link href={`/instructor/hardware/devices/${device.id}`} className="font-semibold text-dark-text hover:text-teal-primary">{device.asset_tag}</Link>
        <span className="text-muted-text"> · {KIND_LABELS[device.kind]}{device.make_model ? ` · ${device.make_model}` : ''}</span>
      </div>
      {student !== undefined && (
        <div className="min-w-0 flex-1">
          {student
            ? <Link href={`/instructor/hardware/students/${student.id}`} className="text-dark-text hover:text-teal-primary">{student.name ?? student.email}</Link>
            : <span className="text-muted-text">—</span>}
        </div>
      )}
      {meta && <span className={`whitespace-nowrap ${metaTone === 'urgent' ? 'text-red-600 font-semibold' : 'text-muted-text'}`}>{meta}</span>}
      {action && <div className="ml-auto flex items-center gap-3 whitespace-nowrap">{action}</div>}
    </li>
  )
}

export default async function HardwarePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; kind?: string; status?: string; q?: string }>
}) {
  const viewer = await getHardwareViewer()
  const params = await searchParams
  const tab: Tab = params.tab && params.tab in TABS ? (params.tab as Tab) : 'devices'
  const kind = DEVICE_KINDS.includes(params.kind as DeviceKind) ? (params.kind as DeviceKind) : undefined
  const status = DEVICE_STATUSES.includes(params.status as DeviceStatus) ? (params.status as DeviceStatus) : undefined
  const q = (params.q ?? '').slice(0, 80)
  const admin = createServiceSupabaseClient()

  let body: React.ReactNode
  if (tab === 'devices') {
    const devices = await loadDevices(admin, { kind, status, q })
    const people = await loadPeople(admin, devices.map(d => d.current_holder_id))
    body = (
      <>
        <form method="get" className="flex flex-wrap items-end gap-3 mb-5" role="search">
          <input type="hidden" name="tab" value="devices" />
          <label className="text-xs font-semibold text-muted-text flex flex-col gap-1">
            Search
            <input name="q" defaultValue={q} placeholder="Tag, serial, IMEI, phone or student" className={`${inputCls} w-72 max-w-full`} />
          </label>
          <label className="text-xs font-semibold text-muted-text flex flex-col gap-1">
            Type
            <select name="kind" defaultValue={kind ?? ''} className={inputCls}>
              <option value="">All types</option>
              {DEVICE_KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-text flex flex-col gap-1">
            Status
            <select name="status" defaultValue={status ?? ''} className={inputCls}>
              <option value="">All statuses</option>
              {DEVICE_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <button type="submit" className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">Filter</button>
          {(q || kind || status) && <Link href="/instructor/hardware" className="text-sm text-teal-primary hover:underline py-2">Clear</Link>}
        </form>
        <SelectableDevices
          devices={devices}
          people={[...people.values()]}
          emptyText={q || kind || status ? 'No devices match.' : 'No devices yet. Add a purchase to get started.'}
          filterQuery={new URLSearchParams(Object.entries({ kind, status, q }).filter(([, v]) => v) as [string, string][]).toString()}
        />
        <p className="text-xs text-muted-text mt-2">Tick devices to print their labels. To print a whole type (like every booster), filter by it first.</p>
      </>
    )
  } else if (tab === 'students') {
    const [matches, holders] = await Promise.all([searchStudents(admin, q), loadHolders(admin)])
    const personList = (list: { person: Person; extra: string }[]) => (
      <ul className="flex flex-col divide-y divide-border">
        {list.map(({ person, extra }) => (
          <li key={person.id} className="py-2.5 first:pt-0 last:pb-0 text-sm flex flex-wrap gap-x-3">
            <Link href={`/instructor/hardware/students/${person.id}`} className="font-medium text-dark-text hover:text-teal-primary">{person.name ?? person.email}</Link>
            <span className="text-muted-text">{extra}</span>
          </li>
        ))}
      </ul>
    )
    body = (
      <div className="flex flex-col gap-6">
        <form method="get" className="flex flex-wrap items-end gap-3" role="search">
          <input type="hidden" name="tab" value="students" />
          <label className="text-xs font-semibold text-muted-text flex flex-col gap-1">
            Find a student
            <input name="q" defaultValue={q} placeholder="Name or email" className={`${inputCls} w-72 max-w-full`} />
          </label>
          <button type="submit" className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">Search</button>
        </form>
        {q && (
          <Card title={`Search results · ${matches.length}`}>
            {matches.length === 0 ? <p className="text-sm text-muted-text">No students match.</p> : personList(matches.map(p => ({ person: p, extra: p.email })))}
          </Card>
        )}
        <Card title={`Students with equipment · ${holders.length}`}>
          {holders.length === 0
            ? <p className="text-sm text-muted-text">No one has equipment recorded yet.</p>
            : personList(holders.map(({ person, count }) => ({ person, extra: `${count} ${count === 1 ? 'item' : 'items'}` })))}
        </Card>
      </div>
    )
  } else if (tab === 'waitlist') {
    body = <WaitlistManager entries={await loadWaitlist(admin)} />
  } else {
    const [returns, repair, prep, readyToTransfer, hotspotPlans, tickets] = await Promise.all([
      loadOpenReturns(admin),
      loadDevices(admin, { status: 'needs_repair' }),
      loadDevices(admin, { status: 'needs_prep' }),
      loadReadyToTransfer(admin),
      loadHotspotPlans(admin),
      loadOpenTickets(admin),
    ])
    const now = new Date()
    const today = pacificToday()
    const renewals = hotspotPlans
      .filter(h => h.current && renewalState(h.current.ends_on, today) !== 'ok')
      .sort((a, b) => a.current!.ends_on.localeCompare(b.current!.ends_on))
    const noPlan = hotspotPlans.filter(h => !h.current)
    const likelyLost = returns.filter(r => isLikelyLost(r.request.requested_at))
    const waiting = returns.filter(r => !isLikelyLost(r.request.requested_at))

    const sections: { id: string; title: string; hint: string; count: number; urgent?: boolean; rows: React.ReactNode }[] = [
      {
        id: 'tickets', title: 'Support tickets', count: tickets.length,
        urgent: tickets.some(t => ticketNeedsNudge({ ...t.ticket, last_nudged_at: null }, now)),
        hint: 'From the Equipment Support Form. The shipping address is in the Airtable record.',
        rows: tickets.map(({ ticket: t, student, device }) => {
          const days = daysSince(t.created_at, now)
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0 text-sm">
              <div className="min-w-0 sm:w-56">
                <Link href={`/instructor/hardware/tickets/${t.id}`} className="font-semibold text-dark-text hover:text-teal-primary">{t.equipment_type ?? 'Equipment'} issue</Link>
                <span className="text-muted-text"> · {TICKET_STATUS_LABELS[t.status]}</span>
              </div>
              <div className="min-w-0 flex-1">
                {student
                  ? <Link href={`/instructor/hardware/students/${student.id}`} className="text-dark-text hover:text-teal-primary">{student.name ?? student.email}</Link>
                  : <span className="text-red-600">Not matched: {t.submitted_email ?? t.submitted_name}</span>}
                {device && <span className="text-muted-text"> · {device.asset_tag}</span>}
              </div>
              <span className="whitespace-nowrap text-muted-text">{days === 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'} ago`}</span>
              <Link href={`/instructor/hardware/tickets/${t.id}`} className="ml-auto text-xs font-semibold text-teal-primary hover:underline">Open</Link>
            </li>
          )
        }),
      },
      {
        id: 'likely-lost', title: 'Likely lost', urgent: true, count: likelyLost.length,
        hint: `Waiting ${LIKELY_LOST_DAYS} days or more. Confirm to mark them lost, or mark them received if they turned up.`,
        rows: likelyLost.map(({ request, device, student }) => (
          <AttentionRow key={request.id} device={device} student={student} meta={`${daysSince(request.requested_at)} days`} metaTone="urgent"
            action={<>
              {student && <Link href={`/instructor/hardware/receive?student=${student.id}`} className="text-xs font-semibold text-teal-primary hover:underline">Mark received</Link>}
              <ConfirmLostButton deviceId={device.id} tag={device.asset_tag ?? 'this device'} />
            </>} />
        )),
      },
      {
        id: 'awaiting-return', title: 'Awaiting return', count: waiting.length,
        hint: 'Devices we asked students to send back. They get reminders until it arrives.',
        rows: waiting.map(({ request, device, student }) => (
          <AttentionRow key={request.id} device={device} student={student}
            meta={`${daysSince(request.requested_at)} ${daysSince(request.requested_at) === 1 ? 'day' : 'days'}`}
            action={student && <Link href={`/instructor/hardware/receive?student=${student.id}`} className="text-xs font-semibold text-teal-primary hover:underline">Mark received</Link>} />
        )),
      },
      {
        id: 'renewals', title: 'Hotspot renewals', urgent: renewals.some(h => renewalState(h.current!.ends_on, today) === 'expired'), count: renewals.length,
        hint: `Plans ending within ${RENEWAL_ALERT_DAYS} days, or already ended. Renew from the hotspot's Plan card.`,
        rows: renewals.map(({ device, holder, current }) => {
          const left = daysBetween(today, current!.ends_on)
          return (
            <AttentionRow key={device.id} device={device} student={holder}
              meta={left < 0 ? `Ended ${-left} days ago` : left === 0 ? 'Ends today' : `Ends in ${left} days`} metaTone={left <= 14 ? 'urgent' : undefined}
              action={<Link href={`/instructor/hardware/devices/${device.id}`} className="text-xs font-semibold text-teal-primary hover:underline">Renew</Link>} />
          )
        }),
      },
      {
        id: 'no-plan', title: 'Hotspots with no plan', count: noPlan.length,
        hint: 'Add each hotspot\'s plan so you get a reminder before it needs renewing.',
        rows: noPlan.map(({ device, holder }) => (
          <AttentionRow key={device.id} device={device} student={holder}
            action={<Link href={`/instructor/hardware/devices/${device.id}`} className="text-xs font-semibold text-teal-primary hover:underline">Add plan</Link>} />
        )),
      },
      {
        id: 'ready-to-transfer', title: 'Ready to transfer', count: readyToTransfer.length,
        hint: 'Loaned laptops whose student is marked completed in a Tech Career Foundations course and an Intro to Programming course.',
        rows: readyToTransfer.map(({ device, student }) => (
          <AttentionRow key={device.id} device={device} student={student}
            action={<TransferButton deviceId={device.id} tag={device.asset_tag ?? 'this laptop'} name={student.name ?? student.email} />} />
        )),
      },
      {
        id: 'needs-prep', title: 'Needs prep', count: prep.length,
        hint: 'Came back and needs to be wiped and checked before the next student.',
        rows: prep.map(d => <AttentionRow key={d.id} device={d} action={<PreppedButton deviceId={d.id} />} />),
      },
      {
        id: 'needs-repair', title: 'Needs repair', count: repair.length,
        hint: 'Change the status on the device once it is fixed.',
        rows: repair.map(d => <AttentionRow key={d.id} device={d} />),
      },
    ]
    const withItems = sections.filter(s => s.count > 0)
    const clear = sections.filter(s => s.count === 0 && s.id !== 'likely-lost')

    body = (
      <div className="flex flex-col gap-6">
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sections.map(s => {
            const tile = (
              <>
                <span className={`block text-2xl font-bold ${s.count === 0 ? 'text-muted-text' : s.urgent ? 'text-red-600' : 'text-dark-text'}`}>{s.count}</span>
                <span className="block text-xs font-semibold text-muted-text mt-0.5">{s.title}</span>
              </>
            )
            return (
              <li key={s.id}>
                {s.count > 0 ? (
                  <a href={`#${s.id}`} className="block h-full rounded-xl border border-border bg-surface px-4 py-3 hover:border-teal-primary">{tile}</a>
                ) : (
                  <div className="h-full rounded-xl border border-border px-4 py-3">{tile}</div>
                )}
              </li>
            )
          })}
        </ul>

        {withItems.length === 0 && <p className="text-sm text-muted-text">All clear. Nothing is waiting on you.</p>}

        {withItems.map(s => (
          <div key={s.id} id={s.id} className="scroll-mt-24">
            <Card title={`${s.title} · ${s.count}`}>
              <p className="text-xs text-muted-text mb-4">{s.hint}</p>
              <ul className="flex flex-col divide-y divide-border">{s.rows}</ul>
            </Card>
          </div>
        ))}

        {withItems.length > 0 && clear.length > 0 && (
          <p className="text-sm text-muted-text">All clear: {clear.map(s => s.title).join(', ')}.</p>
        )}
      </div>
    )
  }

  return (
    <HardwareShell viewer={viewer} breadcrumbs={[{ label: 'Hardware' }]} active={tab}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">{TABS[tab].title}</h1>
          <p className="text-sm text-muted-text mt-1">{TABS[tab].subtitle}</p>
        </div>
        {tab === 'devices' && (
          <div className="flex flex-wrap gap-2">
            <Link href="/instructor/hardware/purchases/new" className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 transition-opacity">
              + Add a purchase
            </Link>
            <Link href="/instructor/hardware/devices/new" className="text-sm font-semibold px-5 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
              + Add one device
            </Link>
          </div>
        )}
      </div>
      {body}
    </HardwareShell>
  )
}
