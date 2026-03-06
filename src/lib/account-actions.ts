'use server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export async function updateUserName(name: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createServiceSupabaseClient()
  const { error } = await admin
    .from('users')
    .update({ name: name.trim() })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return {}
}
