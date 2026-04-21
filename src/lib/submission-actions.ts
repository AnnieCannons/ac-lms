'use server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

type SubmissionType = 'text' | 'link' | 'file'

export async function saveSubmission(
  assignmentId: string,
  status: 'draft' | 'submitted',
  content: string,
  submissionType: SubmissionType,
  existingSubmissionId: string | null,
  submittedAt: string | null,
): Promise<{
  data?: { id: string; submission_type: SubmissionType; content: string | null; status: string; grade: string | null; graded_at: string | null; submitted_at: string; student_comment: string | null };
  historyEntry?: { id: string; submission_type: SubmissionType; content: string | null; submitted_at: string };
  error?: string;
}> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createServiceSupabaseClient()

  const payload: Record<string, unknown> = {
    submission_type: submissionType,
    content,
    status,
    ...(submittedAt ? {} : { submitted_at: new Date().toISOString() }),
    ...(status === 'submitted' ? { grade: null, graded_at: null, graded_by: null } : {}),
  }

  let submissionId: string
  let savedRow: { id: string; submission_type: SubmissionType; content: string | null; status: string; grade: string | null; graded_at: string | null; submitted_at: string; student_comment: string | null } | null = null

  if (existingSubmissionId) {
    // Verify this submission belongs to the current user
    const { data: existing } = await admin
      .from('submissions')
      .select('student_id')
      .eq('id', existingSubmissionId)
      .single()
    if (!existing || existing.student_id !== user.id) return { error: 'Not authorized' }

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

