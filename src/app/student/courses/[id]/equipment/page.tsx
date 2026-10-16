import { redirect } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getStudentCourseViewer } from '@/lib/student-course-viewer'
import { loadMyEquipment } from '@/lib/hardware-server'
import { supportFormUrl } from '@/lib/hardware'
import StudentCuttingEdgeShell from '@/components/cutting-edge/StudentCuttingEdgeShell'
import MyEquipmentCard from '@/components/hardware/MyEquipmentCard'

/** The student's own AnnieCannons equipment, from the course sidebar. Read-only. */
export default async function StudentEquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viewer = await getStudentCourseViewer(id)
  const { data: course } = await viewer.supabase.from('courses').select('id, name, paid_learners').eq('id', id).single()
  if (!course) redirect('/student/courses')

  // Preview has no student of its own; otherwise the viewed student's own equipment.
  const admin = createServiceSupabaseClient()
  const [equipment, { data: person }] = viewer.preview
    ? [null, { data: null }]
    : await Promise.all([
        loadMyEquipment(admin, viewer.viewerId),
        admin.from('users').select('email').eq('id', viewer.viewerId).maybeSingle(),
      ])
  const email = (person as { email: string } | null)?.email ?? null

  return (
    <StudentCuttingEdgeShell viewer={viewer} course={course}>
      <h1 className="text-2xl font-bold text-dark-text mb-1">My Equipment</h1>
      <p className="text-sm text-muted-text mb-6">The laptop, hotspot or wifi booster AnnieCannons has given you.</p>
      {viewer.preview ? (
        <p className="text-sm text-muted-text">In preview there&apos;s no student, so there&apos;s no equipment to show.</p>
      ) : equipment && equipment.devices.length > 0 ? (
        <MyEquipmentCard equipment={equipment} email={email} />
      ) : (
        <div className="bg-surface rounded-2xl border border-border p-5 flex flex-col gap-3 text-sm">
          <p className="text-dark-text">You don&apos;t have any AnnieCannons equipment recorded yet.</p>
          <p className="text-muted-text">If you do have a laptop, hotspot or booster from us and something&apos;s wrong with it, let us know.</p>
          <div>
            <a href={supportFormUrl(email)} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:bg-border/20">
              Report a problem with my equipment<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      )}
    </StudentCuttingEdgeShell>
  )
}
