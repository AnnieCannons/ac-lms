import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import DocsLayout from '@/components/docs/DocsLayout'
import GettingStarted from '@/components/docs/student/GettingStarted'
import Courses from '@/components/docs/student/Courses'
import Assignments from '@/components/docs/student/Assignments'
import Quizzes from '@/components/docs/student/Quizzes'
import Resources from '@/components/docs/student/Resources'
import Observer from '@/components/docs/student/Observer'

export const dynamic = 'force-dynamic'

const SECTIONS: Record<string, React.ComponentType> = {
  'getting-started': GettingStarted,
  'courses': Courses,
  'assignments': Assignments,
  'quizzes': Quizzes,
  'resources': Resources,
  'observer': Observer,
}

export default async function StudentDocSectionPage({
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

  // Instructors/admins can view student docs; students are allowed; others are not
  const role = profile?.role
  if (!role) redirect('/login')

  // Students trying to access instructor docs get redirected — handled in instructor route
  // Here: if instructor tries student docs, allow (they can toggle)
  const isInstructor = role === 'instructor' || role === 'admin'

  const SectionComponent = SECTIONS[section]
  if (!SectionComponent) notFound()

  const backHref = isInstructor ? '/instructor/courses' : '/student/courses'

  return (
    <DocsLayout guide="student" section={section} isInstructor={isInstructor} backHref={backHref}>
      <SectionComponent />
    </DocsLayout>
  )
}
