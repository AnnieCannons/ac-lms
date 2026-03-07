import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import StudentDetailView, { type CategorizedAssignment } from '@/components/ui/StudentDetailView'

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>
}) {
  const { id: courseId, userId } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'instructor' && profile?.role !== 'admin') redirect('/unauthorized')

  const admin = createServiceSupabaseClient()

  const { data: course } = await admin
    .from('courses')
    .select('id, name')
    .eq('id', courseId)
    .single()

  if (!course) redirect('/instructor/courses')

  const { data: student } = await admin
    .from('users')
    .select('id, name, email, role')
    .eq('id', userId)
    .single()

  if (!student) redirect(`/instructor/courses/${courseId}/roster`)

  // Verify this user is enrolled in the course
  const { data: enrollment } = await admin
    .from('course_enrollments')
    .select('role')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!enrollment) redirect(`/instructor/courses/${courseId}/roster`)

  // Parallel fetches
  const [
    { data: accommodation },
    authResult,
    { data: rawModules },
  ] = await Promise.all([
    admin.from('accommodations').select('camera_off, notes').eq('user_id', userId).maybeSingle(),
    admin.auth.admin.getUserById(userId).catch(() => ({ data: { user: null }, error: null })),
    admin
      .from('modules')
      .select('id, title, week_number, order, module_days(id, order, assignments(id, title, due_date, published))')
      .eq('course_id', courseId)
      .order('order', { ascending: true }),
  ])

  const lastSignInAt: string | null =
    (authResult as { data: { user: { last_sign_in_at?: string } | null } }).data?.user?.last_sign_in_at ?? null

  // Flatten to all published assignments with module context
  type RawAssignment = { id: string; title: string; due_date: string | null; published: boolean }
  const allAssignments: Omit<CategorizedAssignment, 'isLate'>[] = (rawModules ?? []).flatMap(m => {
    const days = (m.module_days ?? []) as { id: string; assignments: RawAssignment[] }[]
    return days.flatMap(d =>
      (d.assignments ?? [])
        .filter(a => a.published)
        .map(a => ({
          id: a.id,
          title: a.title,
          due_date: a.due_date,
          moduleTitle: m.title ?? '',
          weekNumber: m.week_number ?? null,
        }))
    )
  })

  const assignmentIds = allAssignments.map(a => a.id)

  const { data: submissions } = assignmentIds.length > 0
    ? await admin
        .from('submissions')
        .select('assignment_id, status, grade, submitted_at')
        .eq('student_id', userId)
        .in('assignment_id', assignmentIds)
    : { data: [] }

  // Categorize
  const now = new Date()
  const subMap = new Map((submissions ?? []).map(s => [s.assignment_id, s]))

  const missing: CategorizedAssignment[] = []
  const late: CategorizedAssignment[] = []
  const submitted: CategorizedAssignment[] = []
  const complete: CategorizedAssignment[] = []
  const incomplete: CategorizedAssignment[] = []

  for (const a of allAssignments) {
    const sub = subMap.get(a.id)
    const duePassed = a.due_date ? new Date(a.due_date) < now : false
    const isLate = !!(
      sub?.submitted_at &&
      a.due_date &&
      new Date(sub.submitted_at) > new Date(a.due_date)
    )
    const entry: CategorizedAssignment = { ...a, isLate }

    if (!sub || sub.status === 'draft') {
      if (duePassed) missing.push(entry)
    } else if (sub.status === 'submitted') {
      submitted.push(entry)
      if (isLate) late.push(entry)
    } else if (sub.status === 'graded') {
      if (isLate) late.push(entry)
      if (sub.grade === 'complete') complete.push(entry)
      else if (sub.grade === 'incomplete') incomplete.push(entry)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />

      <div className="flex">
        <InstructorSidebar courseId={courseId} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-10 focus:outline-none">
            <div className="mb-6">
              <Link
                href={`/instructor/courses/${courseId}/roster`}
                className="text-sm text-muted-text hover:text-teal-primary"
              >
                ← Roster
              </Link>
            </div>

            <StudentDetailView
              courseId={courseId}
              student={{
                id: student.id,
                name: student.name ?? '',
                email: student.email ?? '',
                role: student.role ?? 'student',
              }}
              accommodation={
                accommodation
                  ? { cameraOff: accommodation.camera_off ?? false, notes: accommodation.notes ?? '' }
                  : null
              }
              lastSignInAt={lastSignInAt}
              missing={missing}
              late={late}
              submitted={submitted}
              complete={complete}
              incomplete={incomplete}
              totalPublished={allAssignments.length}
            />
          </main>
        </div>
      </div>
    </div>
  )
}
