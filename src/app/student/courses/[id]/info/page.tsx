import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'
import HtmlContent from '@/components/ui/HtmlContent'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import DailySchedule from '@/components/ui/DailySchedule'
import { CourseOutlineView } from '@/components/ui/GeneralInfoEditor'
import YearlyScheduleSection from '@/components/ui/YearlyScheduleSection'
import GlobalContentSection from '@/components/ui/GlobalContentSection'

const HTML_CLASSES = `text-sm text-dark-text leading-relaxed
  [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h1:first-child]:mt-0
  [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
  [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
  [&_p]:mb-2 [&_p:last-child]:mb-0
  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5
  [&_a]:text-teal-primary [&_a]:underline [&_strong]:font-semibold
  [&_table]:w-full [&_table]:border-collapse [&_table]:mb-3
  [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-muted-text [&_th]:uppercase [&_th]:tracking-wide [&_th]:py-2 [&_th]:px-3 [&_th]:border-b [&_th]:border-border
  [&_td]:py-2 [&_td]:px-3 [&_td]:border-b [&_td]:border-border [&_td]:align-top`

export default async function GeneralInfoPage({
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

  if (profile?.role === 'instructor' || profile?.role === 'admin') {
    redirect(`/instructor/courses/${id}`)
  }

  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', id)
    .eq('role', 'student')
    .maybeSingle()

  if (!enrollment) redirect('/student/courses')

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code')
    .eq('id', id)
    .single()

  if (!course) redirect('/student/courses')

  const { data: sections } = await supabase
    .from('course_sections')
    .select('id, title, content, order, type')
    .eq('course_id', id)
    .eq('published', true)
    .order('order', { ascending: true })

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <Link href="/student/courses" className="text-xl font-extrabold text-dark-text">
          AC<span className="text-teal-primary">*</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {profile?.name} · <span className="text-teal-primary font-medium capitalize">{profile?.role}</span>
          </span>
          <LogoutButton />
        </div>
      </nav>

      <div className="flex">
        <ResizableSidebar>
          <StudentCourseNav courseId={id} courseName={course.name} />
        </ResizableSidebar>

        <div className="flex-1 min-w-0">
          <main className="max-w-3xl mx-auto px-8 py-10">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text">General Info</h1>
              <p className="text-sm text-muted-text mt-1">{course.name}</p>
            </div>

            {sections && sections.length > 0 ? (
              <div className="flex flex-col gap-4">
                {sections.map(section => (
                  <div key={section.id} className="bg-surface rounded-2xl border border-border p-6">
                    <h2 className="font-semibold text-dark-text mb-4">{section.title}</h2>
                    {section.type === 'daily_schedule' && <DailySchedule />}
                    {section.type === 'course_outline' && <CourseOutlineView content={section.content} />}
                    {section.type === 'yearly_schedule' && <YearlyScheduleSection />}
                    {section.type === 'computer_wifi' && <GlobalContentSection slug="computer-wifi" />}
                    {section.type === 'policies_procedures' && <GlobalContentSection slug="policies" />}
                    {(section.type === 'text' || !section.type) && (
                      section.content
                        ? <HtmlContent html={section.content} className={HTML_CLASSES} />
                        : <p className="text-sm text-muted-text italic">No content yet.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-surface rounded-2xl border border-border p-12 text-center">
                <p className="text-muted-text">No general information available yet.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
