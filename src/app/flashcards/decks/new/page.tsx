import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NewDeckClient from './NewDeckClient'

const ADMIN_ROLES = ['instructor', 'staff', 'admin']

export default async function NewDeckPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = ADMIN_ROLES.includes(profile?.role ?? '')

  return <NewDeckClient isAdmin={isAdmin} />
}
