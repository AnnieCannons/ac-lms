import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InstructorTopNav from '@/components/ui/InstructorTopNav'

export default async function InstructorDashboardPage() {
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

  const canAccessPartnerships = profile?.role === 'staff' || profile?.role === 'admin'
  const canAccessForms = profile?.role === 'instructor' || profile?.role === 'staff' || profile?.role === 'admin'
  const cardCount = [true, canAccessPartnerships, true, true, canAccessForms].filter(Boolean).length
  const gridCols = cardCount >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <main className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        <h1 className="text-3xl font-bold text-dark-text mb-2">Dashboard</h1>
        <p className="text-muted-text mb-12">What would you like to do?</p>

        <div className={`grid grid-cols-1 ${gridCols} gap-5`}>
          <Link
            href="/instructor/courses"
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-8 hover:border-teal-primary hover:shadow-md transition-all"
          >
            <div className="text-3xl">📚</div>
            <div>
              <p className="text-lg font-semibold text-dark-text group-hover:text-teal-primary transition-colors">LMS</p>
              <p className="text-sm text-muted-text mt-1">Courses, assignments, grades</p>
            </div>
          </Link>

          {canAccessPartnerships && (
            <Link
              href="/instructor/partnerships"
              className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-8 hover:border-teal-primary hover:shadow-md transition-all"
            >
              <div className="text-3xl">🤝</div>
              <div>
                <p className="text-lg font-semibold text-dark-text group-hover:text-teal-primary transition-colors">Partners</p>
                <p className="text-sm text-muted-text mt-1">Organizations &amp; contacts</p>
              </div>
            </Link>
          )}

          <Link
            href="/instructor/students"
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-8 hover:border-teal-primary hover:shadow-md transition-all"
          >
            <div className="text-3xl">🎓</div>
            <div>
              <p className="text-lg font-semibold text-dark-text group-hover:text-teal-primary transition-colors">Students</p>
              <p className="text-sm text-muted-text mt-1">Progress &amp; attendance</p>
            </div>
          </Link>

          <Link
            href="/instructor/users"
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-8 hover:border-teal-primary hover:shadow-md transition-all"
          >
            <div className="text-3xl">👥</div>
            <div>
              <p className="text-lg font-semibold text-dark-text group-hover:text-teal-primary transition-colors">Users</p>
              <p className="text-sm text-muted-text mt-1">All accounts &amp; roles</p>
            </div>
          </Link>

          {canAccessForms && (
            <Link
              href="/instructor/forms"
              className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-8 hover:border-teal-primary hover:shadow-md transition-all"
            >
              <div className="text-3xl">📋</div>
              <div>
                <p className="text-lg font-semibold text-dark-text group-hover:text-teal-primary transition-colors">Forms</p>
                <p className="text-sm text-muted-text mt-1">Program surveys &amp; submissions</p>
              </div>
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}
