import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const HARDWARE_ROLES = ['instructor', 'staff', 'admin']

export type HardwareViewer = { userId: string; name: string | null; role: string }

/**
 * Page-level access for /instructor/hardware/*: instructors, staff and admins only.
 * TAs (a course-scoped role, never a users.role) and students are redirected.
 */
export async function getHardwareViewer(): Promise<HardwareViewer> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  if (!HARDWARE_ROLES.includes(role)) redirect('/unauthorized')
  return { userId: user.id, name: profile?.name ?? null, role }
}
