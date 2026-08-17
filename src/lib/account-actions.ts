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

export async function updateUserAvatar(avatarUrl: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // The upload API route already scopes uploads to the caller's own user id folder;
  // this just double-checks the URL actually points there before storing it.
  if (!avatarUrl.includes(`/avatars/${user.id}/`)) return { error: 'Invalid avatar URL' }

  const admin = createServiceSupabaseClient()
  const { error } = await admin
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return {}
}
