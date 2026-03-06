import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StudentTopNav from '@/components/ui/StudentTopNav'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import AccountForm from '@/components/ui/AccountForm'

export default async function AccountPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const isInstructor = profile?.role === 'instructor' || profile?.role === 'admin'

  return (
    <div className="min-h-screen bg-background">
      {isInstructor
        ? <InstructorTopNav name={profile?.name} role={profile?.role} />
        : <StudentTopNav name={profile?.name} role={profile?.role} />
      }

      <main id="main-content" tabIndex={-1} className="max-w-xl mx-auto px-8 py-12 focus:outline-none">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href={isInstructor ? '/instructor/courses' : '/student/courses'}
            className="text-sm text-muted-text hover:text-teal-primary transition-colors"
          >
            ← Back
          </Link>
          <span className="text-border">/</span>
          <h1 className="text-2xl font-bold text-dark-text">My Account</h1>
        </div>

        <AccountForm
          initialName={profile?.name ?? ''}
          initialEmail={user.email ?? ''}
        />
      </main>
    </div>
  )
}
