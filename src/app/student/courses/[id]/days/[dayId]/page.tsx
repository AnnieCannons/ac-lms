import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

const RESOURCE_ICONS: Record<string, string> = {
  video: '▶',
  reading: '📖',
  link: '🔗',
  file: '📄',
}

export default async function StudentDayDetailPage({
  params,
}: {
  params: Promise<{ id: string; dayId: string }>
}) {
  const { id, dayId } = await params
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

  // Verify enrollment
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

  const { data: day } = await supabase
    .from('module_days')
    .select('id, day_name, module_id, modules(id, title, week_number)')
    .eq('id', dayId)
    .single()

  if (!day) redirect(`/student/courses/${id}`)

  const { data: resources } = await supabase
    .from('resources')
    .select('*')
    .eq('module_day_id', dayId)
    .order('order', { ascending: true })

  const { data: assignments } = await supabase
    .from('assignments')
    .select('id, title, description, due_date')
    .eq('module_day_id', dayId)
    .eq('published', true)
    .order('due_date', { ascending: true })

  const module = Array.isArray(day.modules) ? day.modules[0] : day.modules

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

      <main className="max-w-4xl mx-auto px-8 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-text mb-6 flex-wrap">
          <Link href="/student/courses" className="hover:text-teal-primary">My Courses</Link>
          <span className="text-border">/</span>
          <Link href={`/student/courses/${id}`} className="hover:text-teal-primary">{course.name}</Link>
          <span className="text-border">/</span>
          {module && <span className="text-muted-text">{module.title}</span>}
          <span className="text-border">/</span>
          <span className="text-dark-text font-medium">{day.day_name}</span>
        </div>

        <h2 className="text-2xl font-bold text-dark-text mb-1">{day.day_name}</h2>
        {module && (
          <p className="text-muted-text text-sm mb-8">
            {module.title}{module.week_number ? ` · Week ${module.week_number}` : ''}
          </p>
        )}

        <div className="flex flex-col gap-8">
          {/* Resources */}
          <section>
            <h3 className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">Resources</h3>
            {resources && resources.length > 0 ? (
              <div className="flex flex-col gap-2">
                {resources.map(resource => (
                  <a
                    key={resource.id}
                    href={resource.content ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-surface rounded-xl border border-border px-4 py-3 flex items-center gap-3 hover:border-teal-primary transition-colors"
                  >
                    <span className="text-base">{RESOURCE_ICONS[resource.type] ?? '•'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark-text truncate">{resource.title}</p>
                      {resource.description ? (
                        <p className="text-xs text-muted-text truncate">{resource.description}</p>
                      ) : (
                        <p className="text-xs text-muted-text capitalize">{resource.type}</p>
                      )}
                    </div>
                    <span className="text-xs text-teal-primary shrink-0">Open →</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-muted-text text-sm">No resources for this day.</p>
            )}
          </section>

          {/* Assignments */}
          <section>
            <h3 className="text-sm font-semibold text-muted-text uppercase tracking-wide mb-3">Assignments</h3>
            {assignments && assignments.length > 0 ? (
              <div className="flex flex-col gap-3">
                {assignments.map(assignment => (
                  <div
                    key={assignment.id}
                    className="bg-surface rounded-xl border border-border px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-dark-text">{assignment.title}</p>
                        {assignment.description && (
                          <p className="text-sm text-muted-text mt-1 line-clamp-2">{stripHtml(assignment.description)}</p>
                        )}
                        {assignment.due_date && (
                          <p className="text-xs text-muted-text mt-2">
                            Due {new Date(assignment.due_date).toLocaleDateString('en-US', {
                              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/student/courses/${id}/assignments/${assignment.id}`}
                        className="text-xs text-teal-primary font-medium hover:underline shrink-0"
                      >
                        View →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-text text-sm">No assignments for this day.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
