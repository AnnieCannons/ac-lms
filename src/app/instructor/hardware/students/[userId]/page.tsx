import { notFound } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareViewer } from '@/lib/hardware-access'
import { loadPeople, loadStudentHardware } from '@/lib/hardware-server'
import HardwareShell from '@/components/hardware/HardwareShell'
import DeviceTable from '@/components/hardware/DeviceTable'
import HistoryTimeline from '@/components/hardware/HistoryTimeline'

export default async function StudentHardwarePage({ params }: { params: Promise<{ userId: string }> }) {
  const viewer = await getHardwareViewer()
  const { userId } = await params
  const admin = createServiceSupabaseClient()
  const { data: student } = await admin.from('users').select('id, name, email').eq('id', userId).maybeSingle()
  if (!student) notFound()

  const { currentDevices, pastDevices, history } = await loadStudentHardware(admin, student.id)
  const people = await loadPeople(admin, history.map(e => e.actor_id))
  const devices = new Map([...currentDevices, ...pastDevices].map(d => [d.id, d]))

  return (
    <HardwareShell viewer={viewer} breadcrumbs={[{ label: 'Hardware', href: '/instructor/hardware?tab=students' }, { label: student.name ?? student.email }]}>
      <h1 className="text-2xl font-bold text-dark-text">{student.name ?? student.email}</h1>
      <p className="text-sm text-muted-text mb-8">{student.email}</p>

      <section className="mb-8">
        <h2 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-3">Has now</h2>
        <DeviceTable devices={currentDevices} people={people} showHolder={false} emptyText="No equipment recorded." />
      </section>
      {pastDevices.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-3">Had before</h2>
          <DeviceTable devices={pastDevices} people={people} />
        </section>
      )}
      <section>
        <h2 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-3">History</h2>
        <HistoryTimeline events={history} people={people} devices={devices} />
      </section>
    </HardwareShell>
  )
}
