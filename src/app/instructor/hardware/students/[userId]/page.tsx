import { notFound } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareViewer } from '@/lib/hardware-access'
import { loadDevices, loadPeople, loadReplacements, loadStudentHardware } from '@/lib/hardware-server'
import HardwareShell from '@/components/hardware/HardwareShell'
import DeviceTable from '@/components/hardware/DeviceTable'
import HistoryTimeline from '@/components/hardware/HistoryTimeline'
import HasNowCard from '@/components/hardware/HasNowCard'
import ReplacementPanel from '@/components/hardware/ReplacementPanel'
import Card from '@/components/hardware/Card'

export default async function StudentHardwarePage({ params }: { params: Promise<{ userId: string }> }) {
  const viewer = await getHardwareViewer()
  const { userId } = await params
  const admin = createServiceSupabaseClient()
  const { data: student } = await admin.from('users').select('id, name, email').eq('id', userId).maybeSingle()
  if (!student) notFound()

  const [{ currentDevices, pastDevices, history }, replacements, inStock] = await Promise.all([
    loadStudentHardware(admin, student.id),
    loadReplacements(admin, student.id),
    loadDevices(admin, { status: 'in_stock' }),
  ])
  const people = await loadPeople(admin, history.map(e => e.actor_id))
  const devices = new Map([...currentDevices, ...pastDevices].map(d => [d.id, d]))
  const deviceTags = Object.fromEntries([...devices.values()].map(d => [d.id, d.asset_tag ?? '']))
  const loaned = currentDevices.filter(d => d.status !== 'owned_by_student')
  const studentLaptops = currentDevices.filter(d => d.kind === 'laptop' && ['on_loan', 'owned_by_student'].includes(d.status))
  const displayName = student.name ?? student.email
  const inStockLaptops = inStock.filter(d => d.kind === 'laptop' && !d.current_holder_id)

  return (
    <HardwareShell viewer={viewer} active="students" breadcrumbs={[{ label: 'Hardware', href: '/instructor/hardware?tab=students' }, { label: displayName }]}>
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">{displayName}</h1>
          <p className="text-sm text-muted-text">{student.email}</p>
        </div>

        <HasNowCard studentId={student.id} loaned={loaned} inStock={inStock.filter(d => !d.current_holder_id)} name={displayName}>
          <DeviceTable devices={currentDevices} people={people} showHolder={false} emptyText="No equipment recorded." />
        </HasNowCard>

        <ReplacementPanel
          studentId={student.id}
          replacements={replacements}
          studentLaptops={studentLaptops}
          inStockLaptops={inStockLaptops}
          deviceTags={deviceTags}
        />

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
