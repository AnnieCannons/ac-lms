import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/** Account roles that manage hardware fully. */
export const HARDWARE_ROLES = ['instructor', 'staff', 'admin']

export type HardwareViewer = {
  userId: string
  name: string | null
  role: string
  /**
   * Instructors, staff and admins manage everything. TAs (a course-scoped role, stored in
   * course_enrollments, never users.role) get day-to-day access only: loan devices, mark
   * received, mark needs prep / wiped and checked, update support tickets and add notes.
   */
  canManage: boolean
}

/**
 * Who the signed-in user is to the hardware tracker, without redirecting: a manager, a TA
 * in at least one course (day-to-day only), or null (no access). Used by pages and actions.
 */
export async function getHardwareActor(): Promise<HardwareViewer | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  if (HARDWARE_ROLES.includes(role)) return { userId: user.id, name: profile?.name ?? null, role, canManage: true }

  const { data: ta } = await supabase.from('course_enrollments').select('course_id').eq('user_id', user.id).eq('role', 'ta').limit(1)
  if (Array.isArray(ta) && ta.length > 0) return { userId: user.id, name: profile?.name ?? null, role, canManage: false }
  return null
}

/**
 * Page-level access for /instructor/hardware/*. Students are redirected away; TAs may view
 * and do day-to-day work, and pages for setup-only work (`manage: true`) send them back to
 * the Hardware home page.
 */
export async function getHardwareViewer({ manage = false }: { manage?: boolean } = {}): Promise<HardwareViewer> {
  const viewer = await getHardwareActor()
  if (!viewer) {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    redirect(user ? '/unauthorized' : '/login')
  }
  if (manage && !viewer.canManage) redirect('/instructor/hardware')
  return viewer
}
