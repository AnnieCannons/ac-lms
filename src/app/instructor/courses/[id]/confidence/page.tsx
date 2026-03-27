import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import InstructorConfidenceView from '@/components/ui/InstructorConfidenceView'
import { getInstructorOrTaAccess } from '@/lib/instructor-access'

export default async function InstructorConfidencePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { profile, isTa } = await getInstructorOrTaAccess(id)

  let admin: ReturnType<typeof createServiceSupabaseClient>
  try { admin = createServiceSupabaseClient() } catch { redirect('/instructor/courses') }

  const { data: course } = await admin
    .from('courses')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!course) redirect('/instructor/courses')

  // All enrollments — both current students and past (dropped) students
  const { data: enrollments } = await admin
    .from('course_enrollments')
    .select('user_id, role, users(id, name)')
    .eq('course_id', id)

  const enrolledStudentIds = new Set<string>()
  const allStudentMap = new Map<string, { id: string; name: string; isPast: boolean }>()

  for (const e of enrollments ?? []) {
    const u = Array.isArray(e.users) ? e.users[0] : e.users
    const name = (u as { name: string } | null)?.name ?? 'Unknown'
    const isCurrent = e.role === 'student'
    if (isCurrent) enrolledStudentIds.add(e.user_id)
    if (e.role === 'student' || e.role === 'observer') {
      allStudentMap.set(e.user_id, { id: e.user_id, name, isPast: false })
    }
  }

  // Mark past students (had a student enrollment but are no longer active)
  // We consider anyone who is not currently enrolled with role=student as "past"
  // In practice, dropped students may keep their enrollment row with a different role or just be absent
  // For now: if user_id appears in enrollments but not in enrolledStudentIds, mark as past
  for (const e of enrollments ?? []) {
    if (!allStudentMap.has(e.user_id)) {
      const u = Array.isArray(e.users) ? e.users[0] : e.users
      const name = (u as { name: string } | null)?.name ?? 'Unknown'
      allStudentMap.set(e.user_id, { id: e.user_id, name, isPast: true })
    } else if (!enrolledStudentIds.has(e.user_id)) {
      const existing = allStudentMap.get(e.user_id)!
      allStudentMap.set(e.user_id, { ...existing, isPast: true })
    }
  }

  const allStudentIds = [...allStudentMap.keys()]

  // Fetch confidence skills for all students in this course
  const { data: skillsData } = allStudentIds.length
    ? await admin
        .from('confidence_skills')
        .select('id, user_id, name')
        .in('user_id', allStudentIds)
    : { data: [] }

  const skillIds = (skillsData ?? []).map(s => s.id)

  const { data: entriesData } = skillIds.length
    ? await admin
        .from('confidence_entries')
        .select('skill_id, user_id, score, created_at')
        .in('skill_id', skillIds)
        .order('created_at', { ascending: true })
    : { data: [] }

  // Build a map: normalized skill name → display name (first seen, title-cased)
  const skillDisplayNames = new Map<string, string>()
  for (const s of skillsData ?? []) {
    const key = s.name.trim().toLowerCase()
    if (!skillDisplayNames.has(key)) {
      skillDisplayNames.set(key, s.name.trim())
    }
  }
  const skillNames = [...skillDisplayNames.values()].sort((a, b) => a.localeCompare(b))

  // Build skill id → normalized name lookup
  const skillIdToNorm = new Map<string, string>()
  for (const s of skillsData ?? []) {
    skillIdToNorm.set(s.id, s.name.trim().toLowerCase())
  }

  // Build per-student skill entries — key by display name so lookup matches column headers
  type EntryRow = { score: number; created_at: string }
  const studentSkills = new Map<string, Record<string, EntryRow[]>>()
  for (const e of entriesData ?? []) {
    const normName = skillIdToNorm.get(e.skill_id)
    if (!normName) continue
    const displayName = skillDisplayNames.get(normName)
    if (!displayName) continue
    if (!studentSkills.has(e.user_id)) studentSkills.set(e.user_id, {})
    const skills = studentSkills.get(e.user_id)!
    if (!skills[displayName]) skills[displayName] = []
    skills[displayName].push({ score: e.score, created_at: e.created_at })
  }

  // Assemble student rows
  const students = [...allStudentMap.values()]
    .map(s => ({
      id: s.id,
      name: s.name,
      isPast: s.isPast,
      skills: studentSkills.get(s.id) ?? {},
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav
        name={profile?.name}
        role={profile?.role}
        isTa={isTa}
        breadcrumbs={[
          { label: 'Courses', href: '/instructor/courses' },
          { label: course.name, href: `/instructor/courses/${id}` },
          { label: 'Confidence Tracker' },
        ]}
      />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main className="max-w-5xl mx-auto px-8 py-10">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text mb-1">Confidence Tracker</h1>
              <p className="text-sm text-muted-text">{course.name} · student self-reported skill confidence</p>
            </div>

            <InstructorConfidenceView
              students={students}
              skillNames={skillNames}
            />
          </main>
        </div>
      </div>
    </div>
  )
}
