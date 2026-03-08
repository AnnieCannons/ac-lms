import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentTopNav from '@/components/ui/StudentTopNav'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import HtmlContent from '@/components/ui/HtmlContent'
import { isStudentPreview } from '@/lib/student-preview'
import StudentViewBanner from '@/components/ui/StudentViewBanner'

const HTML_CLASSES = `text-sm text-dark-text leading-relaxed
  [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h1:first-child]:mt-0
  [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
  [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
  [&_p]:mb-2 [&_p:last-child]:mb-0
  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5
  [&_a]:text-teal-primary [&_a]:underline [&_strong]:font-semibold`

const BENEFIT_SLUGS = [
  { slug: 'benefits-healthcare', title: 'Healthcare' },
  { slug: 'benefits-vision', title: 'Vision' },
  { slug: 'benefits-dental', title: 'Dental' },
]

export default async function StudentBenefitsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const preview = await isStudentPreview(id)

  if (!preview && (profile?.role === 'instructor' || profile?.role === 'admin')) {
    // Check if they are a TA for this course — if so, allow access to benefits
    const { data: taEnrollment } = await supabase
      .from('course_enrollments')
      .select('role')
      .eq('user_id', user.id)
      .eq('course_id', id)
      .maybeSingle()
    if (taEnrollment?.role !== 'ta') {
      redirect(`/instructor/courses/${id}`)
    }
  }

  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', id)
    .in('role', ['student', 'observer', 'ta'])
    .maybeSingle()

  if (!preview && !enrollment) redirect('/student/courses')

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code, paid_learners')
    .eq('id', id)
    .single()

  if (!course) redirect('/student/courses')
  if (!course.paid_learners) redirect(`/student/courses/${id}`)

  const { data: globalContent } = await supabase
    .from('global_content')
    .select('slug, content')
    .in('slug', BENEFIT_SLUGS.map(b => b.slug))

  const contentMap = Object.fromEntries((globalContent ?? []).map(r => [r.slug, r.content]))

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />
      {preview && <StudentViewBanner courseId={id} />}

      <div className="flex">
        <ResizableSidebar>
          <StudentCourseNav courseId={id} courseName={course.name} paidLearners={true} />
        </ResizableSidebar>

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-8 py-10 focus:outline-none">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text">Benefits</h1>
              <p className="text-sm text-muted-text mt-1">{course.name}</p>
            </div>

            <div className="flex flex-col gap-6">
              {BENEFIT_SLUGS.map(({ slug, title }) => (
                <div key={slug} className="bg-surface rounded-2xl border border-border p-6">
                  <h2 className="text-base font-bold text-dark-text mb-4">{title}</h2>
                  {contentMap[slug] ? (
                    <HtmlContent html={contentMap[slug]} className={HTML_CLASSES} />
                  ) : (
                    <p className="text-sm text-muted-text italic">No information available yet.</p>
                  )}
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
