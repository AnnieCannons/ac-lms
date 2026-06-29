'use server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { isLateInTimezone } from '@/lib/date-utils'

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

  // Determine is_late on the first real submission (draft → submitted or brand new)
  let isLatePayload: Record<string, unknown> = {}
  let existingStatus: string | null = null

  if (existingSubmissionId) {
    // Fetch ownership + current status together
    const { data: existing } = await admin
      .from('submissions')
      .select('student_id, status')
      .eq('id', existingSubmissionId)
      .single()
    if (!existing || existing.student_id !== user.id) return { error: 'Not authorized' }
    existingStatus = existing.status
  }

  const isFirstSubmission = status === 'submitted' && (!existingSubmissionId || existingStatus === 'draft')

  if (isFirstSubmission && studentTimezone) {
    const now = new Date().toISOString()
    const [{ data: assignment }, { data: override }] = await Promise.all([
      admin.from('assignments').select('due_date').eq('id', assignmentId).single(),
      admin.from('assignment_overrides').select('due_date').eq('assignment_id', assignmentId).eq('student_id', user.id).maybeSingle(),
    ])
    const effectiveDueDate = (override?.due_date ?? assignment?.due_date) as string | null
    isLatePayload = {
      student_timezone: studentTimezone,
      is_late: isLateInTimezone(now, effectiveDueDate, studentTimezone),
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

