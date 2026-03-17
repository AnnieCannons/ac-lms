import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'
import StudentCourseNav from '@/components/ui/StudentCourseNav'
import ResizableSidebar from '@/components/ui/ResizableSidebar'
import LevelUpFilter from '@/components/ui/LevelUpFilter'
import { isStudentPreview } from '@/lib/student-preview'
import StudentViewBanner from '@/components/ui/StudentViewBanner'

export default async function StudentLevelUpPage({
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
    redirect(`/instructor/courses/${id}`)
  }

  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('course_id', id)
    .in('role', ['student', 'ta'])
    .maybeSingle()

  if (!preview && !enrollment) redirect('/student/courses')

  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single()

  if (!course) redirect('/student/courses')

  const [{ data: rawModules }, { data: bonusAssignmentsRaw }] = await Promise.all([
    supabase
      .from('modules')
      .select('*, skill_tags, module_days(id, day_name, order, deleted_at, assignments!module_day_id(id, title, due_date, published, skill_tags, is_bonus, deleted_at), resources!module_day_id(id, type, title, content, description, order, deleted_at))')
      .eq('course_id', id)
      .eq('category', 'level_up')
      .eq('published', true)
      .is('deleted_at', null)
      .order('order', { ascending: true }),
    // Bonus assignments from non-level_up modules
    supabase
      .from('assignments')
      .select('id, title, due_date, skill_tags, module_day_id, module_days!module_day_id(module_id, modules(course_id, category))')
      .eq('is_bonus', true)
      .eq('published', true)
      .is('deleted_at', null),
  ])

  const modules = (rawModules ?? [])
    .filter(m => !m.title?.includes('DO NOT PUBLISH'))
    .map(m => ({
      ...m,
      module_days: (m.module_days ?? [])
        .filter((d: { deleted_at: string | null }) => !d.deleted_at)
        .map((d: { assignments?: Array<{ deleted_at: string | null }>; resources?: Array<{ deleted_at: string | null }> }) => ({
          ...d,
          assignments: (d.assignments ?? []).filter(a => !a.deleted_at),
          resources: (d.resources ?? []).filter(r => !r.deleted_at),
        })),
    }))

  const moduleIds = modules.map(m => m.id)
  const admin = createServiceSupabaseClient()
  const { data: wikisData } = moduleIds.length > 0
    ? await admin.from('wikis').select('id, title, content, module_id').in('module_id', moduleIds).eq('published', true).order('order', { ascending: true })
    : { data: [] }
  const wikis = (wikisData ?? []) as Array<{ id: string; title: string; content: string; module_id: string | null }>

  const modulesWithWikis = modules.map(m => ({
    ...m,
    wikis: wikis.filter(w => w.module_id === m.id),
  }))

  // Filter bonus assignments to this course and non-level_up modules
  type BonusAssignment = { id: string; title: string; due_date: string | null; skill_tags: string[] | null }
  const bonusAssignments: BonusAssignment[] = ((bonusAssignmentsRaw ?? []) as unknown as Array<{
    id: string; title: string; due_date: string | null; skill_tags: string[] | null
    module_days: { module_id: string; modules: { course_id: string; category: string | null } | null } | null
  }>).filter(a => {
    const mod = Array.isArray(a.module_days) ? a.module_days[0]?.modules : a.module_days?.modules
    return mod?.course_id === id && mod?.category !== 'level_up'
  })

  const hasContent = modules.length > 0 || bonusAssignments.length > 0

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />
      {preview && <StudentViewBanner courseId={id} />}

      <div className="flex">
        <ResizableSidebar>
          <StudentCourseNav courseId={id} courseName={course.name} paidLearners={course.paid_learners ?? false} />
        </ResizableSidebar>

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-8 py-10 focus:outline-none">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/student/courses" className="text-muted-text hover:text-teal-primary text-sm">
                ← My Courses
              </Link>
            </div>

            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text mb-1">Level Up Your Skills</h1>
              <p className="text-muted-text text-sm">{course.code}</p>
            </div>

            {hasContent ? (
              <div className="flex flex-col gap-10">
                {modules.length > 0 && (
                  <LevelUpFilter
                    modules={modulesWithWikis as Parameters<typeof LevelUpFilter>[0]['modules']}
                    courseId={id}
                  />
                )}

                {bonusAssignments.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-4">Bonus Assignments</h2>
                    <div className="flex flex-col gap-3">
                      {bonusAssignments.map(a => (
                        <div key={a.id} className="bg-surface rounded-xl border border-border px-4 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className="font-medium text-dark-text">{a.title}</p>
                                <span className="text-xs font-medium bg-purple-light text-purple-primary border border-purple-primary/30 rounded-full px-2 py-0.5">Bonus</span>
                              </div>
                              {(a.skill_tags ?? []).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {(a.skill_tags ?? []).map(tag => (
                                    <span key={tag} className="text-xs bg-teal-light text-teal-primary border border-teal-primary/30 rounded-full px-2 py-0.5">{tag}</span>
                                  ))}
                                </div>
                              )}
                              {a.due_date && (
                                <p className="text-xs text-muted-text mt-1.5">
                                  Due {new Date(a.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                            <Link
                              href={`/student/courses/${id}/assignments/${a.id}`}
                              className="text-xs text-teal-primary font-medium hover:underline shrink-0"
                            >
                              View →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-surface rounded-2xl border border-border p-12 text-center">
                <p className="text-muted-text">No content available yet.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
