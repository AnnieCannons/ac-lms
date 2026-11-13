import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareViewer } from '@/lib/hardware-access'
import { DEVICE_COLUMNS } from '@/lib/hardware-server'
import { loadTicket } from '@/lib/hardware-tickets-server'
import { formatPacific, KIND_LABELS, type HardwareDevice } from '@/lib/hardware'
import { TICKET_STATUS_LABELS } from '@/lib/hardware-tickets'
import HardwareShell from '@/components/hardware/HardwareShell'
import Card from '@/components/hardware/Card'
import { TicketDevicePick, TicketStatusForm, TicketStudentMatch } from '@/components/hardware/TicketControls'

const UUID = /^[0-9a-f-]{36}$/i

/** One Equipment Support Form submission. The shipping address stays in Airtable. */
export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const viewer = await getHardwareViewer()
  const { ticketId } = await params
  if (!UUID.test(ticketId)) notFound()
  const admin = createServiceSupabaseClient()
  const row = await loadTicket(admin, ticketId)
  if (!row) notFound()
  const { ticket: t, student, device } = row
  const { data: held } = student
    ? await admin.from('hardware_devices').select(DEVICE_COLUMNS).eq('current_holder_id', student.id).order('asset_tag')
    : { data: [] }
  const studentDevices = (held as HardwareDevice[] | null) ?? []
  const who = student ? (student.name ?? student.email) : (t.submitted_name ?? t.submitted_email ?? 'Unknown')

  return (
    <HardwareShell viewer={viewer} active="attention" breadcrumbs={[{ label: 'Hardware', href: '/instructor/hardware' }, { label: 'Needs attention', href: '/instructor/hardware?tab=attention' }, { label: 'Ticket' }]}>
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div>
          <p className="text-xs font-semibold text-muted-text uppercase tracking-widest">Support ticket · {TICKET_STATUS_LABELS[t.status]}</p>
          <h1 className="text-2xl font-bold text-dark-text">{t.equipment_type ?? 'Equipment'} issue from {who}</h1>
          <p className="text-sm text-muted-text mt-1">Submitted {formatPacific(t.created_at)}</p>
        </div>

        <Card title="What they said" action={t.airtable_url ? (
          <a href={t.airtable_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-teal-primary hover:underline">
            Airtable record (shipping address)<span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : undefined}>
          <div className="flex flex-col gap-3 text-sm">
            {t.issue ? <p className="text-dark-text whitespace-pre-line">{t.issue}</p> : <p className="text-muted-text">No description.</p>}
            {t.other_info && <p className="text-muted-text whitespace-pre-line"><span className="font-semibold text-dark-text">Also: </span>{t.other_info}</p>}
            <p className="text-xs text-muted-text">On the form: {[t.submitted_name, t.submitted_email].filter(Boolean).join(' · ') || '—'}</p>
          </div>
        </Card>

        <Card title="Student and device">
          <div className="flex flex-col gap-4 text-sm">
            {student ? (
              <p>
                <Link href={`/instructor/hardware/students/${student.id}`} className="font-semibold text-dark-text hover:text-teal-primary">{who}</Link>
                <span className="text-muted-text"> · {student.email}</span>
              </p>
            ) : (
              <>
                <p className="text-red-600">Couldn&apos;t match {t.submitted_email ?? 'this email'} to a student in the LMS.</p>
                <TicketStudentMatch ticketId={t.id} />
              </>
            )}
            {device && (
              <p>
                About <Link href={`/instructor/hardware/devices/${device.id}`} className="font-semibold text-teal-primary hover:underline">{device.asset_tag}</Link>
                <span className="text-muted-text"> · {KIND_LABELS[device.kind]}{device.make_model ? ` · ${device.make_model}` : ''}</span>
              </p>
            )}
            {student && <TicketDevicePick ticketId={t.id} devices={studentDevices} current={t.device_id} />}
          </div>
        </Card>

        <Card title="Status">
          <TicketStatusForm ticketId={t.id} status={t.status} />
        </Card>
      </div>
    </HardwareShell>
  )
}
