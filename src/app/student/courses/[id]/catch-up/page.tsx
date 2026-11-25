import { redirect } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getStudentCourseViewer } from '@/lib/student-course-viewer'
import StudentCuttingEdgeShell from '@/components/cutting-edge/StudentCuttingEdgeShell'
import CatchUpForm from '@/components/catch-up/CatchUpForm'
import { CATCH_UP_INSTRUCTIONS_URL, describeAbsence, isDateParam } from '@/lib/class-catch-up'
import { formatEventWhen } from '@/lib/cutting-edge'

type PastForm = { id: string; missed_blocks: string; makeup_plan: string; submitted_at: string; followed_up_at: string | null }

/** The Class Catch Up Form. The 5am absence DM links here with ?date= so the missed blocks are pre-filled. */
export default async function StudentCatchUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { id } = await params
  const { date } = await searchParams
  const viewer = await getStudentCourseViewer(id)
  const { data: course } = await viewer.supabase.from('courses').select('id, name, paid_learners').eq('id', id).single()
  if (!course) redirect('/student/courses')

  const absenceDate = isDateParam(date) ? date : null
  const admin = createServiceSupabaseClient()
  const [{ data: alert }, { data: past }] = viewer.preview
    ? [{ data: null }, { data: [] }]
    : await Promise.all([
        absenceDate
          ? admin.from('class_absence_alerts').select('blocks').eq('student_id', viewer.viewerId).eq('absence_date', absenceDate).maybeSingle()
          : Promise.resolve({ data: null }),
        viewer.studentDb
          .from('class_catch_up_forms')
          .select('id, missed_blocks, makeup_plan, submitted_at, followed_up_at')
          .eq('student_id', viewer.viewerId)
          .eq('course_id', id)
          .order('submitted_at', { ascending: false })
          .limit(20),
      ])
  const initialMissedBlocks = absenceDate ? describeAbsence(absenceDate, (alert as { blocks: string[] } | null)?.blocks ?? []) : ''
  const canSend = !viewer.preview && !viewer.readOnly && viewer.enrollmentRole === 'student'
  const forms = (past ?? []) as PastForm[]

  return (
    <StudentCuttingEdgeShell viewer={viewer} course={course}>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Class Catch Up Form</h1>
      <p className="text-sm text-muted-text mb-2">
        Please fill out this form any time you miss a class. Your instructor will follow up with you about your plan.
      </p>
      <p className="text-sm mb-6">
        <a href={CATCH_UP_INSTRUCTIONS_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-teal-primary underline">
          More instructions and information<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>

      {!canSend && (
        <p className="text-sm badge-amber border rounded-lg px-3 py-2 mb-4">
          {viewer.preview || viewer.readOnly ? 'This is a preview, so the form can’t be sent.' : 'Only students in this course can send the catch-up form.'}
        </p>
      )}

      <CatchUpForm courseId={id} absenceDate={absenceDate} initialMissedBlocks={initialMissedBlocks} disabled={!canSend} />

      {forms.length > 0 && (
        <section className="mt-10" aria-labelledby="past-catch-up">
          <h2 id="past-catch-up" className="text-lg font-bold text-dark-text mb-3">Forms you&apos;ve sent</h2>
          <ul className="flex flex-col gap-3">
            {forms.map(f => (
              <li key={f.id} className="bg-surface rounded-xl border border-border px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-dark-text">{f.missed_blocks}</span>
                  <span className="text-xs text-muted-text">Sent {formatEventWhen(f.submitted_at)}</span>
                </div>
                <p className="mt-1 text-muted-text whitespace-pre-line line-clamp-3">{f.makeup_plan}</p>
                {f.followed_up_at && <p className="mt-1 text-xs text-teal-primary font-semibold">Your instructor followed up</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </StudentCuttingEdgeShell>
  )
}
