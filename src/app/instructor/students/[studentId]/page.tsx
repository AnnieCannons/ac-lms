import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import StudentProfileView, { type ProfileCourse } from '@/components/ui/StudentProfileView'

function isCurrentCourse(startDate: string | null | undefined, endDate?: string | null): boolean {
  if (!startDate) return false
  const start = new Date(startDate).getTime()
  const end = endDate ? new Date(endDate).getTime() : start + 105 * 24 * 60 * 60 * 1000
  const now = Date.now()
  return now >= start && now <= end
}

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') redirect('/student/courses')

  const admin = createServiceSupabaseClient()

  const { data: student } = await admin.from('users').select('id, name, email').eq('id', studentId).single()
  if (!student) redirect('/instructor/students')

  const { data: enrollments } = await admin
    .from('course_enrollments')
    .select('course_id, courses(id, name, start_date, end_date, airtable_course_name, is_template)')
    .eq('user_id', studentId)
    .eq('role', 'student')

  type EnrollmentRow = {
    course_id: string
    courses: { id: string; name: string; start_date: string | null; end_date: string | null; airtable_course_name: string | null; is_template: boolean } | null
  }

  const courses: ProfileCourse[] = ((enrollments as unknown as EnrollmentRow[]) ?? [])
    .filter(e => e.courses && !e.courses.is_template)
    .map(e => ({
      id: e.courses!.id,
      name: e.courses!.name,
      startDate: e.courses!.start_date,
      endDate: e.courses!.end_date,
      airtableCourseName: e.courses!.airtable_course_name,
      isCurrent: isCurrentCourse(e.courses!.start_date, e.courses!.end_date),
    }))
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
      return (b.startDate ?? '').localeCompare(a.startDate ?? '')
    })

  if (courses.length === 0) redirect('/instructor/students')

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav
        name={profile?.name}
        role={profile?.role}
        breadcrumbs={[
          { label: 'Dashboard', href: '/instructor' },
          { label: 'Students', href: '/instructor/students' },
          { label: student.name ?? '' },
        ]}
      />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-6">
          <Link href="/instructor/students" className="text-muted-text hover:text-teal-primary text-sm">← Students</Link>
        </div>
        <h1 className="text-2xl font-bold text-dark-text mb-1">{student.name}</h1>
        <p className="text-sm text-muted-text mb-8">{student.email}</p>
        <StudentProfileView
          student={{ id: student.id, name: student.name ?? '', email: student.email ?? '' }}
          courses={courses}
        />
      </main>
    </div>
  )
}
