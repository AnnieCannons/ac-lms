import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import ClassReadinessView from '@/components/ui/ClassReadinessView'
import { getInstructorOrTaAccess } from '@/lib/instructor-access'
import { getCourseReadinessSummary } from '@/lib/readiness-actions'

export default async function ClassReadinessPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { profile, isTa } = await getInstructorOrTaAccess(id, `/student/courses/${id}`)
  if (isTa) redirect(`/instructor/courses/${id}`)

  const admin = createServiceSupabaseClient()

  const { data: course } = await admin.from('courses').select('id, name').eq('id', id).single()
  if (!course) redirect('/instructor/courses')

  const students = await getCourseReadinessSummary(id)

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} isTa={isTa} breadcrumbs={[{ label: 'Courses', href: '/instructor/courses' }, { label: course.name, href: `/instructor/courses/${id}` }, { label: 'Class Readiness' }]} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-8 py-10 focus:outline-none">
            <h1 className="text-2xl font-bold text-dark-text mb-2">Class Readiness</h1>
            <p className="text-sm text-muted-text mb-8">Each student&apos;s most recent weekly readiness score. Click a name for their full history and escalation timeline.</p>
            <ClassReadinessView courseId={id} students={students} />
          </main>
        </div>
      </div>
    </div>
  )
}
