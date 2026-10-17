import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { getHardwareViewer } from '@/lib/hardware-access'
import HardwareShell from '@/components/hardware/HardwareShell'
import CheckinNewForm, { type CourseOption } from '@/components/hardware/CheckinNewForm'

const DAY = 24 * 60 * 60 * 1000

/** A course is offered first if it's running now or starts within the next 30 days. */
function isCurrent(c: { start_date: string | null; end_date: string | null }, now: Date): boolean {
  if (!c.start_date) return false
  const start = new Date(`${c.start_date}T00:00:00Z`).getTime()
  const end = c.end_date ? new Date(`${c.end_date}T23:59:59Z`).getTime() : start + 105 * DAY
  return start <= now.getTime() + 30 * DAY && end >= now.getTime()
}

export default async function NewCheckinPage() {
  const viewer = await getHardwareViewer({ manage: true })
  const admin = createServiceSupabaseClient()
  const [{ data: courseRows }, enrollments] = await Promise.all([
    admin.from('courses').select('id, name, start_date, end_date, archived, is_template').order('start_date', { ascending: false, nullsFirst: false }),
    fetchAllRows<{ course_id: string }>((from, to) =>
      admin.from('course_enrollments').select('course_id').in('role', ['student', 'ta']).range(from, to) as unknown as PromiseLike<{ data: { course_id: string }[] | null; error: { message: string } | null }>),
  ])
  const counts = new Map<string, number>()
  for (const e of enrollments) counts.set(e.course_id, (counts.get(e.course_id) ?? 0) + 1)
  const now = new Date()
  type Row = { id: string; name: string; start_date: string | null; end_date: string | null; archived: boolean | null; is_template: boolean | null }
  const courses: CourseOption[] = ((courseRows ?? []) as Row[])
    .filter(c => !c.archived && !c.is_template && (counts.get(c.id) ?? 0) > 0)
    .map(c => ({ id: c.id, name: c.name, start_date: c.start_date, current: isCurrent(c, now), students: counts.get(c.id) ?? 0 }))
  const defaultTitle = `Equipment check-in (${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/Los_Angeles' })})`

  return (
    <HardwareShell viewer={viewer} active="checkin" breadcrumbs={[{ label: 'Hardware', href: '/instructor/hardware' }, { label: 'Check-in', href: '/instructor/hardware/check-in' }, { label: 'Send' }]}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-dark-text mb-1">Send a check-in</h1>
        <p className="text-sm text-muted-text mb-6">
          Students are asked for their laptop serial number, hotspot IMEI or phone number, whether they have a booster, and any past replacements.
          Nothing goes into the tracker until you review each answer.
        </p>
        <CheckinNewForm courses={courses} defaultTitle={defaultTitle} />
      </div>
    </HardwareShell>
  )
}
