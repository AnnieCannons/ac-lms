import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import DocsLayout from '@/components/docs/DocsLayout'
import GettingStarted from '@/components/docs/instructor/GettingStarted'
import CourseEditor from '@/components/docs/instructor/CourseEditor'
import Resources from '@/components/docs/instructor/Resources'
import Assignments from '@/components/docs/instructor/Assignments'
import Quizzes from '@/components/docs/instructor/Quizzes'
import People from '@/components/docs/instructor/People'
import Roster from '@/components/docs/instructor/Roster'
import StudentPreview from '@/components/docs/instructor/StudentPreview'
import Accessibility from '@/components/docs/instructor/Accessibility'
import CareerDev from '@/components/docs/instructor/CareerDev'
import Gradebook from '@/components/docs/instructor/Gradebook'

export const revalidate = 3600

const SECTIONS: Record<string, React.ComponentType> = {
  'getting-started': GettingStarted,
  'course-editor': CourseEditor,
  'resources': Resources,
  'assignments': Assignments,
  'quizzes': Quizzes,
  'career-dev': CareerDev,
  'people': People,
  'roster': Roster,
  'gradebook': Gradebook,
  'student-preview': StudentPreview,
  'accessibility': Accessibility,
}

export default async function InstructorDocSectionPage({
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

  const role = profile?.role
  if (!role) redirect('/login')

  // Students cannot access instructor docs unless they are a TA
  if (role === 'student') {
    // Check if they have a TA enrollment in any course
    const { data: taEnrollment } = await supabase
      .from('course_enrollments')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'ta')
      .limit(1)
      .maybeSingle()
    if (!taEnrollment) redirect('/docs/student/getting-started')
  }

  const SectionComponent = SECTIONS[section]
  if (!SectionComponent) notFound()

  return (
    <DocsLayout guide="instructor" section={section} isInstructor={true} backHref="/instructor/courses" fromPath={from}>
      <SectionComponent />
    </DocsLayout>
  )
}
