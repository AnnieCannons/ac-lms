'use server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export async function updateUserName(name: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 200) return { error: 'Name must be between 1 and 200 characters' }

  const admin = createServiceSupabaseClient()
  const { error } = await admin
    .from('users')
    .update({ name: trimmed })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return {}
}
