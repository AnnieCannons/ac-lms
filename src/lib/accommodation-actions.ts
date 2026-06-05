'use server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export async function upsertAccommodation(
  userId: string,
  cameraOff: boolean,
  notes: string,
  cameraOffStart: string | null,
  cameraOffEnd: string | null
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') return { error: 'Unauthorized' }

  const admin = createServiceSupabaseClient()

  // Instructors may only set accommodations for students enrolled in their own courses
  if (profile?.role === 'instructor') {
    const { data: myCourses } = await admin
      .from('course_enrollments')
      .select('course_id')
      .eq('user_id', user.id)
      .eq('role', 'instructor')
    const myCourseIds = (myCourses ?? []).map(r => r.course_id)
    if (myCourseIds.length === 0) return { error: 'Unauthorized' }
    const { data: sharedCourse } = await admin
      .from('course_enrollments')
      .select('course_id')
      .eq('user_id', userId)
      .in('course_id', myCourseIds)
      .limit(1)
      .maybeSingle()
    if (!sharedCourse) return { error: 'Unauthorized' }
  }
  const { error } = await admin
    .from('accommodations')
    .upsert(
      {
        user_id: userId,
        camera_off: cameraOff,
        camera_off_start: cameraOff ? (cameraOffStart || null) : null,
        camera_off_end: cameraOff ? (cameraOffEnd || null) : null,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: 'user_id' }
    )

  if (error) return { error: error.message }
  return {}
}
