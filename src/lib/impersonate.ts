import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { IMPERSONATE_COOKIE } from '@/lib/impersonate-cookie'
export { IMPERSONATE_COOKIE }

export interface ImpersonationData {
  userId: string
  studentName: string
}

/** Returns impersonation data if an admin has activated student view, otherwise null. */
export async function getImpersonation(): Promise<ImpersonationData | null> {
  const store = await cookies()
  const raw = store.get(IMPERSONATE_COOKIE)?.value
  if (!raw) return null

  let parsed: ImpersonationData
  try { parsed = JSON.parse(decodeURIComponent(raw)) } catch { return null }
  if (!parsed?.userId || !parsed?.studentName) return null

  // Only admins may impersonate
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null

  return parsed
}
