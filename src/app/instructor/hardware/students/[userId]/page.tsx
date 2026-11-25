import { notFound } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareViewer } from '@/lib/hardware-access'
import { loadDevices, loadPeople, loadReplacements, loadStudentHardware } from '@/lib/hardware-server'
import { loadStudentTickets } from '@/lib/hardware-tickets-server'
import { TICKET_STATUS_LABELS } from '@/lib/hardware-tickets'
import { formatPacific } from '@/lib/hardware'
import Link from 'next/link'
import HardwareShell from '@/components/hardware/HardwareShell'
import DeviceTable from '@/components/hardware/DeviceTable'
import HistoryTimeline from '@/components/hardware/HistoryTimeline'
import HasNowCard from '@/components/hardware/HasNowCard'
import ReplacementPanel from '@/components/hardware/ReplacementPanel'
import Card from '@/components/hardware/Card'
import NeedsControls from '@/components/hardware/NeedsControls'
import ShipButton from '@/components/hardware/ShipButton'
import ShipmentsCard from '@/components/hardware/ShipmentsCard'
import InternetPlanCard from '@/components/hardware/InternetPlanCard'
import { loadCohortEquipment, loadMyOnboarding, needsFor } from '@/lib/onboarding-server'
import { KIND_LABELS } from '@/lib/hardware'
import { pendingEquipment } from '@/lib/hardware-shipping'
import { pacificToday } from '@/lib/hardware-reminders'
import { pacificShortDate } from '@/lib/onboarding'

export default async function StudentHardwarePage({ params }: { params: Promise<{ userId: string }> }) {
  const viewer = await getHardwareViewer()
  const { userId } = await params
  const admin = createServiceSupabaseClient()
  const { data: student } = await admin.from('users').select('id, name, email').eq('id', userId).maybeSingle()
  if (!student) notFound()

  const [{ currentDevices, pastDevices, history }, replacements, inStock, tickets, equipment, onboarding] = await Promise.all([
    loadStudentHardware(admin, student.id),
    loadReplacements(admin, student.id),
    loadDevices(admin, { status: 'in_stock' }),
    loadStudentTickets(admin, student.id),
    loadCohortEquipment(admin, [student.id]),
    loadMyOnboarding(admin, student.id),
  ])
  const shipments = equipment.shipments.get(student.id) ?? []
  const plans = equipment.plans.get(student.id) ?? []
  const needs = needsFor(equipment.needs, student.id)
  const waiting = equipment.waiting.get(student.id) ?? new Map()
  const people = await loadPeople(admin, [...history.map(e => e.actor_id), ...shipments.map(s => s.received_by)])
  const devices = new Map([...currentDevices, ...pastDevices].map(d => [d.id, d]))
  const deviceTags = Object.fromEntries([...devices.values()].map(d => [d.id, d.asset_tag ?? '']))
  const loaned = currentDevices.filter(d => d.status !== 'owned_by_student')
  const studentLaptops = currentDevices.filter(d => d.kind === 'laptop' && ['on_loan', 'owned_by_student'].includes(d.status))
  const displayName = student.name ?? student.email
  const inStockLaptops = inStock.filter(d => d.kind === 'laptop' && !d.current_holder_id)
  const today = pacificToday()
  const shippedIds = new Set(shipments.flatMap(s => s.device_ids))
  const unshipped = currentDevices.filter(d => !shippedIds.has(d.id) && ['on_loan', 'owned_by_student'].includes(d.status))
  const pending = pendingEquipment({
    needs,
    heldKinds: currentDevices.filter(d => d.status !== 'awaiting_return').map(d => d.kind),
    waitingKinds: [...waiting.keys()],
    onboarding: onboarding ? (onboarding.finished ? 'finished' : 'in_progress') : null,
  })

  return (
    <HardwareShell viewer={viewer} active="students" breadcrumbs={[{ label: 'Hardware', href: '/instructor/hardware?tab=students' }, { label: displayName }]}>
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">{displayName}</h1>
          <p className="text-sm text-muted-text">{student.email}</p>
        </div>

        <Card
          title="What they need"
          action={(inStock.some(d => !d.current_holder_id) || unshipped.length > 0) ? (
            <ShipButton
              studentId={student.id}
              studentName={displayName}
              needs={needs}
              inStock={inStock.filter(d => !d.current_holder_id)}
              unshipped={unshipped}
              heldKinds={currentDevices.filter(d => d.status !== 'awaiting_return').map(d => d.kind)}
              today={today}
            />
          ) : undefined}
        >
          <NeedsControls studentId={student.id} needs={needs} canManage={viewer.canManage} studentName={displayName} />
          {pending.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {pending.map(p => (
                <li key={p.kind} className="text-muted-text">
                  <strong className="text-dark-text">{KIND_LABELS[p.kind]}:</strong>{' '}
                  {p.state === 'preparing'
                    ? <>waiting to ship{waiting.get(p.kind) ? ` (on the waitlist since ${pacificShortDate(waiting.get(p.kind)!)})` : ''}</>
                    : 'ships once they finish Enrollment Readiness'}
                </li>
              ))}
            </ul>
          )}
          {onboarding && (
            <p className="mt-3 text-xs text-muted-text">
              Enrollment Readiness: {onboarding.finished ? 'finished' : 'in progress'} ·{' '}
              <Link href={`/instructor/onboarding/${onboarding.courseId}/students/${student.id}`} className="font-semibold text-teal-primary hover:underline">Checklist</Link>
            </p>
          )}
        </Card>

        {shipments.length > 0 && (
          <ShipmentsCard
            shipments={shipments}
            deviceTags={deviceTags}
            people={Object.fromEntries([...people.entries()].map(([id, p]) => [id, p.name ?? p.email]))}
            canManage={viewer.canManage}
          />
        )}

        {(needs.wifi === 'comcast_now' || plans.length > 0) && (
          <InternetPlanCard studentId={student.id} plans={plans} today={today} canManage={viewer.canManage} />
        )}

        <HasNowCard studentId={student.id} loaned={loaned} inStock={inStock.filter(d => !d.current_holder_id)} name={displayName} canManage={viewer.canManage}>
          <DeviceTable devices={currentDevices} people={people} showHolder={false} emptyText="No equipment recorded." />
        </HasNowCard>

        <ReplacementPanel
          readOnly={!viewer.canManage}
          studentId={student.id}
          replacements={replacements}
          studentLaptops={studentLaptops}
          inStockLaptops={inStockLaptops}
          deviceTags={deviceTags}
        />

        {tickets.length > 0 && (
          <Card title={`Support tickets · ${tickets.length}`}>
            <ul className="flex flex-col divide-y divide-border">
              {tickets.map(({ ticket: t, device }) => (
                <li key={t.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0 text-sm">
                  <Link href={`/instructor/hardware/tickets/${t.id}`} className="font-medium text-dark-text hover:text-teal-primary">{t.equipment_type ?? 'Equipment'} issue</Link>
                  <span className="text-muted-text">{TICKET_STATUS_LABELS[t.status]}{device ? ` · ${device.asset_tag}` : ''} · {formatPacific(t.created_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {pastDevices.length > 0 && (
          <Card title="Had before">
            <DeviceTable devices={pastDevices} people={people} />
          </Card>
        )}

        <Card title="History">
          <HistoryTimeline events={history} people={people} devices={devices} />
        </Card>
      </div>
    </HardwareShell>
  )
}
