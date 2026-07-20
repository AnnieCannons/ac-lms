'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

/**
 * Self-service recovery for the "I have staff access but no one enrolled me on
 * this specific course" gap. Any global instructor/staff/admin may add themselves
 * as an instructor on any course — the client is responsible for confirming with
 * the user first (naming the course) before calling this. Students can never
 * reach this: the global role check below blocks them outright.
 */
export async function addSelfAsInstructor(courseId: string): Promise<{ error?: string; courseName?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    return { error: 'Only staff can add themselves as an instructor.' }
  }

  const admin = createServiceSupabaseClient()
  const { data: course } = await admin.from('courses').select('name').eq('id', courseId).single()
  if (!course) return { error: 'Course not found.' }

  const { error } = await admin
    .from('course_enrollments')
    .upsert({ course_id: courseId, user_id: user.id, role: 'instructor' }, { onConflict: 'course_id,user_id' })
  if (error) return { error: error.message }

  return { courseName: course.name }
}

/** Look up a course's name for confirmation prompts before the user commits to self-enrolling. */
export async function getCourseName(courseId: string): Promise<{ name?: string; error?: string }> {
  const admin = createServiceSupabaseClient()
  const { data: course } = await admin.from('courses').select('name').eq('id', courseId).single()
  if (!course) return { error: 'Course not found.' }
  return { name: course.name }
}
