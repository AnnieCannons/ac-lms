import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import Link from 'next/link'
import StudentsDashboard from '@/components/ui/StudentsDashboard'

function isCurrentCourse(startDate: string | null | undefined, endDate?: string | null): boolean {
  if (!startDate) return false
  const start = new Date(startDate).getTime()
  const end = endDate ? new Date(endDate).getTime() : start + 105 * 24 * 60 * 60 * 1000
  const now = Date.now()
  return now >= start && now <= end
}

export type CourseWithStudents = {
  id: string
  name: string
  students: { id: string; name: string }[]
}

export default async function StudentsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') redirect('/student/courses')

  const admin = createServiceSupabaseClient()

  // Fetch all current courses
  const { data: courses } = await admin
    .from('courses')
    .select('id, name, start_date, end_date, is_template, archived')
    .order('start_date', { ascending: false })

  const currentCourses = (courses ?? []).filter(c =>
    !c.is_template && !c.archived && isCurrentCourse(c.start_date, c.end_date)
  )

  if (currentCourses.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <InstructorTopNav name={profile?.name} role={profile?.role} breadcrumbs={[{ label: 'Dashboard', href: '/instructor' }, { label: 'Students' }]} />
        <main className="max-w-3xl mx-auto px-6 py-12">
          <p className="text-muted-text">No current courses found.</p>
        </main>
      </div>
    )
  }

  // Fetch enrolled students for all current courses in one query
  const courseIds = currentCourses.map(c => c.id)
  const { data: enrollments } = await admin
    .from('course_enrollments')
    .select('course_id, user_id, users(id, name)')
    .in('course_id', courseIds)
    .eq('role', 'student')

  type EnrollmentRow = { course_id: string; user_id: string; users: { id: string; name: string } | null }

  const courseStudentMap = new Map<string, { id: string; name: string }[]>()
  for (const e of (enrollments as unknown as EnrollmentRow[] ?? [])) {
    if (!e.users?.name) continue
    if (!courseStudentMap.has(e.course_id)) courseStudentMap.set(e.course_id, [])
    courseStudentMap.get(e.course_id)!.push({ id: e.user_id, name: e.users.name })
  }

  const coursesWithStudents: CourseWithStudents[] = currentCourses
    .map(c => ({
      id: c.id,
      name: c.name,
      students: (courseStudentMap.get(c.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter(c => c.students.length > 0)

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav
        name={profile?.name}
        role={profile?.role}
        breadcrumbs={[{ label: 'Dashboard', href: '/instructor' }, { label: 'Students' }]}
      />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-6">
          <Link href="/instructor" className="text-muted-text hover:text-teal-primary text-sm">← Dashboard</Link>
        </div>
        <h1 className="text-2xl font-bold text-dark-text mb-8">Students</h1>
        <StudentsDashboard courses={coursesWithStudents} />
      </main>
    </div>
  )
}
