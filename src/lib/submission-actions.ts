'use server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { isLateInTimezone, isOptionalClosed } from '@/lib/date-utils'
import { getAssignmentCourseId } from '@/lib/course-scope'

// Most lenient zone (UTC-12), same fallback isOptionalClosed uses — so a missing
// timezone can no longer skip the lateness check entirely.
const FALLBACK_TIMEZONE = 'Etc/GMT+12'

type SubmissionType = 'text' | 'link' | 'file'

export async function saveSubmission(
  assignmentId: string,
  status: 'draft' | 'submitted',
  content: string,
  submissionType: SubmissionType,
  existingSubmissionId: string | null,
  submittedAt: string | null,
  studentTimezone: string | null,
): Promise<{
  data?: { id: string; submission_type: SubmissionType; content: string | null; status: string; grade: string | null; graded_at: string | null; submitted_at: string; student_comment: string | null };
  historyEntry?: { id: string; submission_type: SubmissionType; content: string | null; submitted_at: string };
  error?: string;
}> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createServiceSupabaseClient()

  // The assignment must be in a course the caller is enrolled in (or staff previewing).
  const courseId = await getAssignmentCourseId(admin, assignmentId)
  if (!courseId) return { error: 'Assignment not found' }
  const [{ data: enrollment }, { data: profile }] = await Promise.all([
    admin.from('course_enrollments').select('id').eq('course_id', courseId).eq('user_id', user.id).maybeSingle(),
    admin.from('users').select('role').eq('id', user.id).maybeSingle(),
  ])
  if (!enrollment && !['instructor', 'staff', 'admin'].includes(profile?.role ?? '')) return { error: 'Not authorized' }

  // Optional assignments stop taking submissions (including drafts) once the due date passes
  const [{ data: assignmentRow }, { data: overrideRow }] = await Promise.all([
    admin.from('assignments').select('due_date, is_optional').eq('id', assignmentId).single(),
    admin.from('assignment_overrides').select('due_date').eq('assignment_id', assignmentId).eq('student_id', user.id).maybeSingle(),
  ])
  if (assignmentRow?.is_optional && isOptionalClosed((overrideRow?.due_date ?? assignmentRow.due_date) as string | null, studentTimezone)) {
    return { error: 'This optional assignment is closed — the due date has passed.' }
  }

  // Determine is_late on the first real submission (draft → submitted or brand new)
  let isLatePayload: Record<string, unknown> = {}
  let existingStatus: string | null = null

  if (existingSubmissionId) {
    // Fetch ownership + current status together
    const { data: existing } = await admin
      .from('submissions')
      .select('student_id, status, assignment_id')
      .eq('id', existingSubmissionId)
      .single()
    // assignment_id must match too: due date / lateness / optional-closed are all
    // computed from assignmentId, so a mismatched pair would dodge them.
    if (!existing || existing.student_id !== user.id || existing.assignment_id !== assignmentId) return { error: 'Not authorized' }
    existingStatus = existing.status
  }

  const isFirstSubmission = status === 'submitted' && (!existingSubmissionId || existingStatus === 'draft')

  if (isFirstSubmission) {
    const now = new Date().toISOString()
    const effectiveDueDate = (overrideRow?.due_date ?? assignmentRow?.due_date) as string | null
    isLatePayload = {
      student_timezone: studentTimezone || FALLBACK_TIMEZONE,
      is_late: assignmentRow?.is_optional ? false : isLateInTimezone(now, effectiveDueDate, studentTimezone || FALLBACK_TIMEZONE),
    }
  }

  const payload: Record<string, unknown> = {
    submission_type: submissionType,
    content,
    status,
    ...(submittedAt ? {} : { submitted_at: new Date().toISOString() }),
    ...(status === 'submitted' ? { grade: null, graded_at: null, graded_by: null } : {}),
    ...isLatePayload,
  }

  let submissionId: string
  let savedRow: { id: string; submission_type: SubmissionType; content: string | null; status: string; grade: string | null; graded_at: string | null; submitted_at: string; student_comment: string | null } | null = null

  if (existingSubmissionId) {
    const { data, error } = await admin
      .from('submissions')
      .update(payload)
      .eq('id', existingSubmissionId)
      .select('id, submission_type, content, status, grade, graded_at, submitted_at, student_comment')
      .single()
    if (error) return { error: error.message }
    savedRow = data
    submissionId = existingSubmissionId
  } else {
    const { data, error } = await admin
      .from('submissions')
      .upsert(
        { ...payload, assignment_id: assignmentId, student_id: user.id },
        { onConflict: 'assignment_id,student_id' }
      )
      .select('id, submission_type, content, status, grade, graded_at, submitted_at, student_comment')
      .single()
    if (error) return { error: error.message }
    savedRow = data
    submissionId = data.id
  }

  if (!savedRow) return { error: 'Unknown error' }

  let historyEntry: { id: string; submission_type: SubmissionType; content: string | null; submitted_at: string } | undefined

  if (status === 'submitted') {
    const { data: hist } = await admin
      .from('submission_history')
      .insert({
        submission_id: submissionId,
        assignment_id: assignmentId,
        student_id: user.id,
        submission_type: submissionType,
        content,
      })
      .select('id, submission_type, content, submitted_at')
      .single()
    if (hist) historyEntry = hist as typeof historyEntry
  }

  return { data: savedRow, historyEntry }
}

