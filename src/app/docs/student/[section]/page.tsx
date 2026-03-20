import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import DocsLayout from '@/components/docs/DocsLayout'
import GettingStarted from '@/components/docs/student/GettingStarted'
import Courses from '@/components/docs/student/Courses'
import Assignments from '@/components/docs/student/Assignments'
import Quizzes from '@/components/docs/student/Quizzes'
import Resources from '@/components/docs/student/Resources'
import Observer from '@/components/docs/student/Observer'
import Accessibility from '@/components/docs/student/Accessibility'

export const revalidate = 3600

const SECTIONS: Record<string, React.ComponentType> = {
  'getting-started': GettingStarted,
  'courses': Courses,
  'assignments': Assignments,
  'quizzes': Quizzes,
  'resources': Resources,
  'observer': Observer,
  'accessibility': Accessibility,
}

export default async function StudentDocSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { section } = await params
  const { from } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  // Instructors/admins can view student docs; students are allowed; others are not
  const role = profile?.role
  if (!role) redirect('/login')

  // Students trying to access instructor docs get redirected — handled in instructor route
  // Here: if instructor/admin/TA tries student docs, allow (they can toggle)
  let isInstructor = role === 'instructor' || role === 'admin'
  if (!isInstructor && role === 'student') {
    // Check if they are a TA in any course
    const { data: taEnrollment } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'ta')
      .limit(1)
      .maybeSingle()
    if (taEnrollment) isInstructor = true
  }

  const SectionComponent = SECTIONS[section]
  if (!SectionComponent) notFound()

  const backHref = isInstructor ? '/instructor/courses' : '/student/courses'

  return (
    <DocsLayout guide="student" section={section} isInstructor={isInstructor} backHref={backHref} fromPath={from}>
      <SectionComponent />
    </DocsLayout>
  )
}
