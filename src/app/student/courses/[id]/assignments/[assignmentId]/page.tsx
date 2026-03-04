import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/ui/LogoutButton'
import HtmlContent from '@/components/ui/HtmlContent'
import SubmissionForm from '@/components/ui/SubmissionForm'
import StudentChecklist from '@/components/ui/StudentChecklist'

export default async function StudentAssignmentPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>
}) {
  const { id, assignmentId } = await params
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

  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, title, description, how_to_turn_in, due_date, module_day_id, published')
    .eq('id', assignmentId)
    .eq('published', true)
    .single()

  if (!assignment) redirect(`/student/courses/${id}`)

  const { data: day } = await supabase
    .from('module_days')
    .select('id, day_name, module_id, modules(id, title, week_number)')
    .eq('id', assignment.module_day_id)
    .single()

  const { data: checklistItems } = await supabase
    .from('checklist_items')
    .select('id, text, description, order')
    .eq('assignment_id', assignmentId)
    .order('order', { ascending: true })

  const { data: course } = await supabase
    .from('courses')
    .select('id, name, code')
    .eq('id', id)
    .single()

  const { data: existingSubmission } = await supabase
    .from('submissions')
    .select('id, submission_type, content, status, submitted_at')
    .eq('assignment_id', assignmentId)
    .eq('student_id', user.id)
    .maybeSingle()

  const { data: submissionHistory } = await supabase
    .from('submission_history')
    .select('id, submission_type, content, submitted_at')
    .eq('assignment_id', assignmentId)
    .eq('student_id', user.id)
    .order('submitted_at', { ascending: false })

  const module = Array.isArray(day?.modules) ? day?.modules[0] : day?.modules

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

      <main className="max-w-3xl mx-auto px-8 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-text mb-6 flex-wrap">
          <Link href="/student/courses" className="hover:text-teal-primary">My Courses</Link>
          <span className="text-border">/</span>
          <Link href={`/student/courses/${id}`} className="hover:text-teal-primary">{course?.name}</Link>
          {day && (
            <>
              <span className="text-border">/</span>
              <Link href={`/student/courses/${id}/days/${day.id}`} className="hover:text-teal-primary">
                {day.day_name}
              </Link>
            </>
          )}
          <span className="text-border">/</span>
          <span className="text-dark-text font-medium truncate max-w-[200px]">{assignment.title}</span>
        </div>

        <h1 className="text-2xl font-bold text-dark-text mb-1">{assignment.title}</h1>
        <div className="flex items-center gap-4 mb-8">
          {module && (
            <p className="text-muted-text text-sm">{module.title}</p>
          )}
          {assignment.due_date && (
            <p className="text-sm text-muted-text">
              Due {new Date(assignment.due_date).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
              })}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {/* Instructions */}
          {assignment.description && (
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-4">Instructions</p>
              <HtmlContent
                html={assignment.description}
                className="text-sm text-dark-text leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:font-bold [&_h2]:text-base [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mb-1 [&_strong]:font-bold [&_a]:text-teal-primary [&_a]:underline [&_p]:mb-3 [&_li]:mb-1"
              />
            </div>
          )}

          {/* How to turn in */}
          {assignment.how_to_turn_in && (
            <div className="bg-surface rounded-2xl border border-border p-6">
              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-4">How to turn this in</p>
              <HtmlContent
                html={assignment.how_to_turn_in}
                className="text-sm text-dark-text leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-bold [&_a]:text-teal-primary [&_a]:underline [&_p]:mb-3"
              />
            </div>
          )}

          {/* Checklist */}
          {checklistItems && checklistItems.length > 0 && (
            <StudentChecklist assignmentId={assignmentId} studentId={user.id} items={checklistItems} />
          )}

          {/* Submission form */}
          <SubmissionForm
            assignmentId={assignmentId}
            studentId={user.id}
            existingSubmission={existingSubmission ?? null}
            initialHistory={submissionHistory ?? []}
          />
        </div>
      </main>
    </div>
  )
}
