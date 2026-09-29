import { notFound, redirect } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { isConfidenceRatingsEnabled } from '@/lib/feature-flags'
import { getInstructorOrTaAccess } from '@/lib/instructor-access'
import { loadCourseTrend } from '@/lib/confidence-trend-data'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import InstructorSidebar from '@/components/ui/InstructorSidebar'
import SkillConfidenceInstructorView from '@/components/ui/SkillConfidenceInstructorView'

export const dynamic = 'force-dynamic'

export default async function InstructorSkillConfidencePage({ params }: { params: Promise<{ id: string }> }) {
  if (!isConfidenceRatingsEnabled()) notFound()

  const { id } = await params
  const { profile, isTa } = await getInstructorOrTaAccess(id, `/student/courses/${id}`)
  // TAs are excluded from this feature's data (matching Phases 1-3); this must come before
  // the service-role client, which bypasses RLS, is used.
  if (isTa) redirect(`/instructor/courses/${id}`)

  const admin = createServiceSupabaseClient()
  const { data: course } = await admin.from('courses').select('id, name').eq('id', id).single()
  if (!course) redirect('/instructor/courses')

  const data = await loadCourseTrend(admin, id)

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav
        name={profile?.name}
        role={profile?.role}
        isTa={isTa}
        breadcrumbs={[
          { label: 'Courses', href: '/instructor/courses' },
          { label: course.name, href: `/instructor/courses/${id}` },
          { label: 'Skill Confidence' },
        ]}
      />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-5xl mx-auto px-8 py-10 focus:outline-none">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text mb-1">Skill Confidence</h1>
              <p className="text-sm text-muted-text">
                {course.name} · how the class rates the skills tagged on this course&apos;s assignments. Class figures use each student&apos;s most recent rating from this course.
              </p>
            </div>
            <SkillConfidenceInstructorView students={data.students} skills={data.skills} />
          </main>
        </div>
      </div>
    </div>
  )
}
