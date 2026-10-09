'use server'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { isLateInTimezone } from '@/lib/date-utils'

async function getAuthedInstructor() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') return { error: 'Not authorized' as const }
  const admin = createServiceSupabaseClient()
  return { user, admin }
}

/** Verify an assignment belongs to the given course */
async function verifyAssignmentCourse(
  admin: ReturnType<typeof createServiceSupabaseClient>,
  assignmentId: string,
  courseId: string
): Promise<boolean> {
  const { data } = await admin.from('assignments').select('module_day_id').eq('id', assignmentId).single()
  if (!data?.module_day_id) return false
  const { data: day } = await admin.from('module_days').select('module_id').eq('id', data.module_day_id).single()
  if (!day) return false
  const { data: mod } = await admin.from('modules').select('course_id').eq('id', day.module_id).single()
  return mod?.course_id === courseId
}

export async function upsertAssignmentOverride(
  assignmentId: string,
  studentId: string,
  courseId: string,
  dueDate: string | null,
  excused: boolean
): Promise<{ id?: string; error?: string }> {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  if (!await verifyAssignmentCourse(admin, assignmentId, courseId)) return { error: 'Not authorized' }

  const { data, error } = await admin
    .from('assignment_overrides')
    .upsert(
      { assignment_id: assignmentId, student_id: studentId, due_date: dueDate, excused },
      { onConflict: 'assignment_id,student_id' }
    )
    .select('id')
    .single()
  if (error) return { error: error.message }

  // Recalculate is_late on any existing submission if the due date changed
  if (dueDate) {
    const { data: submission } = await admin
      .from('submissions')
      .select('id, submitted_at, student_timezone')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .eq('status', 'submitted')
      .maybeSingle()
    if (submission?.submitted_at) {
      const { data: assignment } = await admin.from('assignments').select('is_optional').eq('id', assignmentId).single()
      // Optional assignments are never late
      const isLate = excused || assignment?.is_optional ? false : isLateInTimezone(submission.submitted_at, dueDate, submission.student_timezone)
      await admin.from('submissions').update({ is_late: isLate }).eq('id', submission.id)
    }
  }

  revalidatePath(`/instructor/courses/${courseId}`)
  return { id: data.id }
}

export async function removeAssignmentOverride(
  overrideId: string,
  courseId: string
): Promise<{ error?: string }> {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  // Verify the override's assignment belongs to this course
  const { data: override } = await admin
    .from('assignment_overrides')
    .select('assignment_id')
    .eq('id', overrideId)
    .single()
  if (!override || !await verifyAssignmentCourse(admin, override.assignment_id, courseId)) {
    return { error: 'Not authorized' }
  }

  const { error } = await admin.from('assignment_overrides').delete().eq('id', overrideId)
  if (error) return { error: error.message }
  revalidatePath(`/instructor/courses/${courseId}`)
  return {}
}

/**
 * Same as upsertAssignmentOverride, for many students at once (the "Paste
 * names" flow). Every student must be enrolled in this course as a student.
 */
export async function bulkUpsertAssignmentOverrides(
  assignmentId: string,
  studentIds: string[],
  courseId: string,
  dueDate: string | null,
  excused: boolean
): Promise<{ overrides?: { id: string; student_id: string }[]; error?: string }> {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }
  const { admin } = auth

  const ids = [...new Set(studentIds)]
  if (ids.length === 0) return { overrides: [] }
  if (!excused && !dueDate) return { error: 'Choose a due date or excuse the students' }
  if (!await verifyAssignmentCourse(admin, assignmentId, courseId)) return { error: 'Not authorized' }

  const { data: enrolled } = await admin
    .from('course_enrollments')
    .select('user_id')
    .eq('course_id', courseId)
    .eq('role', 'student')
    .in('user_id', ids)
  if ((enrolled ?? []).length !== ids.length) return { error: 'Some of these students are not enrolled in this course' }

  const { data, error } = await admin
    .from('assignment_overrides')
    .upsert(
      ids.map(student_id => ({ assignment_id: assignmentId, student_id, due_date: dueDate, excused })),
      { onConflict: 'assignment_id,student_id' }
    )
    .select('id, student_id')
  if (error) return { error: error.message }

  // Recalculate is_late on existing submissions if the due date changed
  if (dueDate) {
    const [{ data: submissions }, { data: assignment }] = await Promise.all([
      admin
        .from('submissions')
        .select('id, submitted_at, student_timezone')
        .eq('assignment_id', assignmentId)
        .in('student_id', ids)
        .eq('status', 'submitted'),
      admin.from('assignments').select('is_optional').eq('id', assignmentId).single(),
    ])
    await Promise.all((submissions ?? []).filter(s => s.submitted_at).map(s => {
      // Optional assignments are never late
      const isLate = excused || assignment?.is_optional ? false : isLateInTimezone(s.submitted_at, dueDate, s.student_timezone)
      return admin.from('submissions').update({ is_late: isLate }).eq('id', s.id)
    }))
  }

  revalidatePath(`/instructor/courses/${courseId}`)
  return { overrides: data ?? [] }
}
