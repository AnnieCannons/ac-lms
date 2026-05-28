import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import FormsGrid from '@/components/ui/FormsGrid'

export default async function FormsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    redirect('/student/courses')
  }

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <main className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-dark-text">Forms</h1>
          <Link
            href="/instructor/forms/submissions"
            className="text-sm text-teal-primary hover:underline"
          >
            View submissions →
          </Link>
        </div>
        <p className="text-muted-text mb-12">Program survey forms for students. Click a form to open it in a modal.</p>
        <FormsGrid />
      </main>
    </div>
  )
}
