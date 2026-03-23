import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogoutButton from '@/components/ui/LogoutButton'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const isInstructor = profile?.role === 'instructor' || profile?.role === 'admin'

  // Learners go straight to their course list
  if (!isInstructor) redirect('/student/courses')

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-dark-text">AC<span className="text-teal-primary">*</span></h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-text">
            {profile?.name} · <span className="text-teal-primary font-medium capitalize">{profile?.role}</span>
          </span>
          <LogoutButton />
        </div>
      </nav>

      {/* Content */}
      <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-8 py-12 focus:outline-none">
        <h2 className="text-2xl font-bold text-dark-text mb-2">
          Welcome back, {profile?.name}!
        </h2>
        <p className="text-muted-text mb-8">Here&apos;s what&apos;s happening in your learning space.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Role card */}
          <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
            <div className="w-10 h-10 bg-teal-light rounded-full flex items-center justify-center mb-4">
              <span className="text-teal-primary font-bold text-lg">*</span>
            </div>
            <h3 className="font-semibold text-dark-text mb-1">Your Role</h3>
            <p className="text-muted-text text-sm capitalize">{profile?.role}</p>
          </div>

          {/* Quick action card */}
          {isInstructor && (
            <a href="/instructor/courses" className="bg-purple-primary rounded-2xl p-6 text-white hover:opacity-90 transition-opacity">
              <h3 className="font-semibold mb-1">Instructor Area</h3>
              <p className="text-purple-200 text-sm">Manage courses and grade submissions</p>
            </a>
          )}
        </div>
      </main>
    </div>
  )
}