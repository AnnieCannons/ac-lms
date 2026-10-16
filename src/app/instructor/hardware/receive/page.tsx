import Link from 'next/link'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getHardwareViewer } from '@/lib/hardware-access'
import { DEVICE_COLUMNS, searchStudents } from '@/lib/hardware-server'
import type { HardwareDevice } from '@/lib/hardware'
import HardwareShell from '@/components/hardware/HardwareShell'
import ReceiveForm from '@/components/hardware/ReceiveForm'

const inputCls = 'px-3 py-2 rounded-lg border border-border bg-background text-dark-text text-sm focus:outline-none focus:border-teal-primary'
const UUID = /^[0-9a-f-]{36}$/i

/** "A box arrived": find the student by name, tick what came back, done. */
export default async function ReceivePage({ searchParams }: { searchParams: Promise<{ q?: string; student?: string }> }) {
  const viewer = await getHardwareViewer()
  const { q = '', student: studentId } = await searchParams
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

  return (
    <HardwareShell viewer={viewer} breadcrumbs={[{ label: 'Hardware', href: '/instructor/hardware' }, { label: 'Mark received' }]}>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Mark received</h1>
      <p className="text-sm text-muted-text mb-6">Find who sent it, tick what came back.</p>

      {student ? (
        <div className="max-w-2xl flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <Link href={`/instructor/hardware/students/${student.id}`} className="text-lg font-semibold text-dark-text hover:text-teal-primary">
              {student.name ?? student.email}
            </Link>
            <span className="text-sm text-muted-text">{student.email}</span>
            <Link href="/instructor/hardware/receive" className="text-sm text-teal-primary hover:underline ml-auto">Someone else</Link>
          </div>
          {devices.length === 0
            ? <p className="text-sm text-muted-text">Nothing on loan to this student.</p>
            : <ReceiveForm devices={devices} />}
        </div>
      ) : (
        <>
          <form method="get" className="flex flex-wrap items-end gap-3 mb-6" role="search">
            <label className="text-xs font-semibold text-muted-text flex flex-col gap-1">
              Student name or email
              <input name="q" defaultValue={q} autoFocus className={`${inputCls} w-72 max-w-full`} />
            </label>
            <button type="submit" className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">Find</button>
          </form>
          {q && (matches.length === 0 ? <p className="text-sm text-muted-text">No students match.</p> : (
            <ul className="flex flex-col gap-1">
              {matches.map(p => (
                <li key={p.id}>
                  <Link href={`/instructor/hardware/receive?student=${p.id}`} className="text-sm text-dark-text hover:text-teal-primary">
                    {p.name ?? p.email} <span className="text-muted-text">· {p.email}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </>
      )}
    </HardwareShell>
  )
}
