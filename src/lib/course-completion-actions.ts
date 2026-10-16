'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

type Result = { ok: true } | { ok: false; error: string }

/** Instructors, staff and admins mark completions. TAs (course-scoped) and students may not. */
async function requireCompletionEditor(): Promise<{ userId: string } | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  return ['instructor', 'staff', 'admin'].includes(profile?.role ?? '') ? { userId: user.id } : null
}

/** Marks (completed = true) or unmarks a student's completion of a course they are enrolled in as a student. */
export async function setCourseCompleted(courseId: string, userId: string, completed: boolean): Promise<Result> {
  const editor = await requireCompletionEditor()
  if (!editor) return { ok: false, error: 'Not authorized.' }

  const admin = createServiceSupabaseClient()
  if (!completed) {
    const { error } = await admin.from('course_completions').delete().eq('course_id', courseId).eq('user_id', userId)
    return error ? { ok: false, error: error.message } : { ok: true }
  }

  const { data: enrollment } = await admin.from('course_enrollments').select('role')
    .eq('course_id', courseId).eq('user_id', userId).maybeSingle()
  if (enrollment?.role !== 'student') return { ok: false, error: 'Only students enrolled in this course can be marked completed.' }

  const { error } = await admin.from('course_completions').upsert(
    { course_id: courseId, user_id: userId, marked_by: editor.userId },
    { onConflict: 'course_id,user_id', ignoreDuplicates: true },
  )
  return error ? { ok: false, error: error.message } : { ok: true }
}
