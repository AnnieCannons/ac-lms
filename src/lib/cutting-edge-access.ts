import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type CuttingEdgeStaffViewer = {
  userId: string
  name: string | null
  role: string | null
  /** Instructors, staff and admins edit; TAs only view */
  canEdit: boolean
}

/**
 * Page-level access for /instructor/cutting-edge-talks/*: instructors, staff and admins,
 * plus anyone who is a TA in at least one course (read-only). Everyone else is redirected.
 */
export async function getCuttingEdgeStaffViewer(): Promise<CuttingEdgeStaffViewer> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  const role = profile?.role ?? null
  if (role === 'instructor' || role === 'staff' || role === 'admin') {
    return { userId: user.id, name: profile?.name ?? null, role, canEdit: true }
  }

  const { data: ta } = await supabase.from('course_enrollments').select('course_id')
    .eq('user_id', user.id).eq('role', 'ta').limit(1)
  if (!ta || ta.length === 0) redirect('/unauthorized')
  return { userId: user.id, name: profile?.name ?? null, role, canEdit: false }
}
