import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const revalidate = 3600

export default async function DocsIndexPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'instructor' || profile?.role === 'admin') {
    redirect('/docs/instructor/getting-started')
  }

  redirect('/docs/student/getting-started')
}
