import Link from 'next/link'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareViewer } from '@/lib/hardware-access'
import { loadDevices, loadHolders, loadPeople, searchStudents } from '@/lib/hardware-server'
import {
  DEVICE_KINDS,
  DEVICE_STATUSES,
  KIND_LABELS,
  STATUS_LABELS,
  type DeviceKind,
  type DeviceStatus,
} from '@/lib/hardware'
import HardwareShell from '@/components/hardware/HardwareShell'
import DeviceTable from '@/components/hardware/DeviceTable'

const TABS = [
  { key: 'devices', label: 'Devices' },
  { key: 'students', label: 'Students' },
  { key: 'attention', label: 'Needs attention' },
] as const
type Tab = (typeof TABS)[number]['key']

const inputCls = 'px-3 py-2 rounded-lg border border-border bg-background text-dark-text text-sm focus:outline-none focus:border-teal-primary'

export default async function HardwarePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; kind?: string; status?: string; q?: string }>
}) {
  const viewer = await getHardwareViewer()
  const params = await searchParams
  const tab: Tab = TABS.some(t => t.key === params.tab) ? (params.tab as Tab) : 'devices'
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
        <p className="text-xs text-muted-text mb-2">{devices.length} {devices.length === 1 ? 'device' : 'devices'}</p>
        <DeviceTable
          devices={devices}
          people={people}
          emptyText={q || kind || status ? 'No devices match.' : 'No devices yet. Add a purchase to get started.'}
        />
      </>
    )
  } else if (tab === 'students') {
    const [matches, holders] = await Promise.all([searchStudents(admin, q), loadHolders(admin)])
    body = (
      <>
        <form method="get" className="flex flex-wrap items-end gap-3 mb-6" role="search">
          <input type="hidden" name="tab" value="students" />
          <label className="text-xs font-semibold text-muted-text flex flex-col gap-1">
            Find a student
            <input name="q" defaultValue={q} placeholder="Name or email" className={`${inputCls} w-72 max-w-full`} />
          </label>
          <button type="submit" className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">Search</button>
        </form>
        {q && (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-3">Search results</h2>
            {matches.length === 0 ? <p className="text-sm text-muted-text">No students match.</p> : (
              <ul className="flex flex-col gap-1">
                {matches.map(p => (
                  <li key={p.id}>
                    <Link href={`/instructor/hardware/students/${p.id}`} className="text-sm text-dark-text hover:text-teal-primary">
                      {p.name ?? p.email} <span className="text-muted-text">· {p.email}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <section>
          <h2 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-3">Students with equipment</h2>
          {holders.length === 0 ? <p className="text-sm text-muted-text">No one has equipment recorded yet.</p> : (
            <ul className="flex flex-col gap-1">
              {holders.map(({ person, count }) => (
                <li key={person.id}>
                  <Link href={`/instructor/hardware/students/${person.id}`} className="text-sm text-dark-text hover:text-teal-primary">
                    {person.name ?? person.email}
                  </Link>
                  <span className="text-xs text-muted-text"> · {count} {count === 1 ? 'item' : 'items'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </>
    )
  } else {
    const [repair, prep] = await Promise.all([
      loadDevices(admin, { status: 'needs_repair' }),
      loadDevices(admin, { status: 'needs_prep' }),
    ])
    const people = new Map()
    body = (
      <>
        <section className="mb-8">
          <h2 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-3">Needs prep</h2>
          <DeviceTable devices={prep} people={people} showHolder={false} emptyText="Nothing waiting to be wiped and checked." />
        </section>
        <section className="mb-8">
          <h2 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-3">Needs repair</h2>
          <DeviceTable devices={repair} people={people} showHolder={false} emptyText="Nothing waiting for repair." />
        </section>
        <p className="text-sm text-muted-text">Returns, hotspot renewals and support tickets will show here as they are added.</p>
      </>
    )
  }

  return (
    <HardwareShell viewer={viewer} breadcrumbs={[{ label: 'Hardware' }]}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">Hardware</h1>
          <p className="text-sm text-muted-text mt-1">Loaner laptops, hotspots and wifi boosters.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/instructor/hardware/purchases/new" className="bg-teal-primary text-white text-sm font-semibold px-5 py-2 rounded-full hover:opacity-90 transition-opacity">
            + Add a purchase
          </Link>
          <Link href="/instructor/hardware/devices/new" className="text-sm font-semibold px-5 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
            + Add one device
          </Link>
        </div>
      </div>
      <nav aria-label="Hardware sections" className="flex gap-1 border-b border-border mb-6">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={t.key === 'devices' ? '/instructor/hardware' : `/instructor/hardware?tab=${t.key}`}
            aria-current={tab === t.key ? 'page' : undefined}
            className={`px-4 py-2 text-sm font-semibold -mb-px border-b-2 ${tab === t.key ? 'border-teal-primary text-teal-primary' : 'border-transparent text-muted-text hover:text-dark-text'}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {body}
    </HardwareShell>
  )
}
