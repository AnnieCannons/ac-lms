import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/** Who can see and act on New Student Onboarding: instructors, staff and admins (never TAs). */
export const ONBOARDING_ROLES = ['instructor', 'staff', 'admin']

export type OnboardingViewer = { userId: string; name: string | null; role: string }

/** The signed-in staff member, or null. For server actions (no redirect). */
export async function getOnboardingActor(): Promise<OnboardingViewer | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('name, role').eq('id', user.id).single()
  const role = profile?.role ?? ''
  return ONBOARDING_ROLES.includes(role) ? { userId: user.id, name: profile?.name ?? null, role } : null
}

/** Page-level access for /instructor/onboarding/*: everyone else is sent away. */
export async function getOnboardingViewer(): Promise<OnboardingViewer> {
  const viewer = await getOnboardingActor()
  if (viewer) return viewer
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? '/unauthorized' : '/login')
}
