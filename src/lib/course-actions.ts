'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function updateCourseDates(
  courseId: string,
  startDate: string | null,
  endDate: string | null,
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
    return { error: 'Not authorized' }
  }

  const { error } = await supabase
    .from('courses')
    .update({ start_date: startDate || null, end_date: endDate || null })
    .eq('id', courseId)

  if (error) return { error: error.message }
  return {}
}
