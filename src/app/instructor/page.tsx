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

  if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
    redirect('/student/courses')
  }

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <main className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        <h1 className="text-3xl font-bold text-dark-text mb-2">Dashboard</h1>
        <p className="text-muted-text mb-12">What would you like to do?</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
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

          <div
            className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-8 opacity-40 cursor-not-allowed select-none"
            title="Coming soon"
          >
            <div className="text-3xl">🤝</div>
            <div>
              <p className="text-lg font-semibold text-dark-text">Partnerships</p>
              <p className="text-sm text-muted-text mt-1">Coming soon</p>
            </div>
          </div>

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
        </div>
      </main>
    </div>
  )
}
