'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { resendInvite, revokeInvite } from '@/lib/people-actions'

interface PendingInvite {
  id: string
  email: string
  role: string
  invited_at: string
  resent_at: string | null
  courseName: string | null
}

function RolePill({ role }: { role: string }) {
  const styles: Record<string, string> = {
    student: 'bg-teal-light text-teal-primary',
    ta: 'bg-blue-100 text-blue-700',
    instructor: 'bg-purple-100 text-purple-700',
    staff: 'bg-blue-100 text-blue-700',
    admin: 'bg-orange-100 text-orange-700',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${styles[role] ?? 'bg-border text-muted-text'}`}>
      {role}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PendingInvitesTable({
  invites,
  currentUserRole,
}: {
  invites: PendingInvite[]
  currentUserRole: 'instructor' | 'staff' | 'admin'
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [resent, setResent] = useState<Set<string>>(new Set())

  async function handleResend(id: string) {
    setResendingId(id)
    setErrors(prev => { const e = { ...prev }; delete e[id]; return e })
    const result = await resendInvite(id)
    setResendingId(null)
    if (result.error) {
      setErrors(prev => ({ ...prev, [id]: result.error! }))
    } else {
      setResent(prev => new Set(prev).add(id))
      startTransition(() => router.refresh())
    }
  }

  async function handleRevoke(id: string) {
    setRevokingId(id)
    const result = await revokeInvite(id)
    setRevokingId(null)
    if (result.error) {
      setErrors(prev => ({ ...prev, [id]: result.error! }))
    } else {
      startTransition(() => router.refresh())
    }
  }

  return (
    <section>
      <h2 className="text-base font-semibold text-dark-text mb-4">
        Pending Invites <span className="text-muted-text font-normal">({invites.length})</span>
      </h2>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border">
              <th className="text-left px-4 py-3 font-semibold text-muted-text">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-text">Role</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-text hidden sm:table-cell">Course</th>
              <th className="text-left px-4 py-3 font-semibold text-muted-text hidden sm:table-cell">Invited</th>
              <th className="sr-only">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invites.map(invite => (
              <tr key={invite.id} className="bg-background">
                <td className="px-4 py-3 text-dark-text">
                  {invite.email}
                  {errors[invite.id] && (
                    <p className="text-xs text-red-600 mt-0.5">{errors[invite.id]}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <RolePill role={invite.role} />
                </td>
                <td className="px-4 py-3 text-muted-text hidden sm:table-cell">
                  {invite.role === 'student' || invite.role === 'ta'
                    ? (invite.courseName ?? '—')
                    : <span className="text-xs italic">Global</span>}
                </td>
                <td className="px-4 py-3 text-muted-text hidden sm:table-cell">
                  {resent.has(invite.id)
                    ? <span className="text-teal-primary text-xs font-medium">Resent</span>
                    : formatDate(invite.resent_at ?? invite.invited_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => handleResend(invite.id)}
                      disabled={resendingId === invite.id || revokingId === invite.id}
                      className="text-xs font-medium text-teal-primary hover:opacity-70 disabled:opacity-40 transition-opacity"
                    >
                      {resendingId === invite.id ? 'Sending…' : 'Resend'}
                    </button>
                    {currentUserRole === 'admin' && (
                      <button
                        onClick={() => handleRevoke(invite.id)}
                        disabled={resendingId === invite.id || revokingId === invite.id}
                        className="text-xs font-medium text-red-500 hover:opacity-70 disabled:opacity-40 transition-opacity"
                      >
                        {revokingId === invite.id ? 'Revoking…' : 'Revoke'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
