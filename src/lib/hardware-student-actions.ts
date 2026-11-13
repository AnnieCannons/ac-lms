'use server'

import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

/**
 * For the "Send back" badge on the student sidebar: how many devices the signed-in user
 * has been asked to return. Only ever reads the caller's own rows (id from auth).
 */
export async function getMyHardwareReturnCount(): Promise<number> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const { count } = await createServiceSupabaseClient().from('hardware_devices')
    .select('id', { count: 'exact', head: true })
    .eq('current_holder_id', user.id).eq('status', 'awaiting_return')
  return count ?? 0
}
