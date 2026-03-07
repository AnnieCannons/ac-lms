'use server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export async function upsertAccommodation(
  userId: string,
  cameraOff: boolean,
  notes: string
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') return { error: 'Unauthorized' }

  const admin = createServiceSupabaseClient()
  const { error } = await admin
    .from('accommodations')
    .upsert(
      {
        user_id: userId,
        camera_off: cameraOff,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: 'user_id' }
    )

  if (error) return { error: error.message }
  return {}
}
