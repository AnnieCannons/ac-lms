import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import Link from 'next/link'

interface Submission {
  id: string
  form_name: string
  program: string | null
  submission_type: string | null
  airtable_record_id: string | null
  submitted_at: string
}

export default async function FormSubmissionsPage() {
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

  const { data: submissions } = await supabase
    .from('form_submissions')
    .select('id, form_name, program, submission_type, airtable_record_id, submitted_at')
    .order('submitted_at', { ascending: false })
    .limit(200)

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />
      <main className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/instructor/forms" className="text-sm text-muted-text hover:text-dark-text transition-colors">
            ← Forms
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-dark-text mb-2">Submissions</h1>
        <p className="text-muted-text mb-10">All form submissions recorded from Airtable.</p>

        {!submissions || submissions.length === 0 ? (
          <div className="text-muted-text text-sm">No submissions yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-5 py-3 text-muted-text font-medium">Form</th>
                  <th className="text-left px-5 py-3 text-muted-text font-medium">Program</th>
                  <th className="text-left px-5 py-3 text-muted-text font-medium">Type</th>
                  <th className="text-left px-5 py-3 text-muted-text font-medium">Submitted</th>
                  <th className="text-left px-5 py-3 text-muted-text font-medium">Airtable ID</th>
                </tr>
              </thead>
              <tbody>
                {(submissions as Submission[]).map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-surface'}>
                    <td className="px-5 py-3 text-dark-text font-medium">{s.form_name}</td>
                    <td className="px-5 py-3 text-muted-text">{s.program ?? '—'}</td>
                    <td className="px-5 py-3 text-muted-text">{s.submission_type ?? '—'}</td>
                    <td className="px-5 py-3 text-muted-text whitespace-nowrap">
                      {new Date(s.submitted_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3 text-muted-text font-mono text-xs">{s.airtable_record_id ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
