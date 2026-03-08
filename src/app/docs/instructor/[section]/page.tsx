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

export const dynamic = 'force-dynamic'

const SECTIONS: Record<string, React.ComponentType> = {
  'getting-started': GettingStarted,
  'course-editor': CourseEditor,
  'resources': Resources,
  'assignments': Assignments,
  'quizzes': Quizzes,
  'people': People,
  'roster': Roster,
  'student-preview': StudentPreview,
}

export default async function InstructorDocSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
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

  // Students cannot access instructor docs — redirect to student docs
  if (role === 'student') redirect('/docs/student/getting-started')

  const SectionComponent = SECTIONS[section]
  if (!SectionComponent) notFound()

  return (
    <DocsLayout guide="instructor" section={section} isInstructor={true} backHref="/instructor/courses">
      <SectionComponent />
    </DocsLayout>
  )
}
