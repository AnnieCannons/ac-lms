'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bulkAddPeopleToCourse, updateEnrollmentRole, resendInvite, revokeInvite, removePersonFromCourse } from '@/lib/people-actions'

type Role = 'student' | 'instructor' | 'admin' | 'observer'

interface Member {
  userId: string
  name: string
  email: string
  role: Role
}

interface Invitation {
  id: string
  email: string
  role: Role
  invited_at: string
  resent_at: string | null
}

interface BulkResult {
  email: string
  added?: boolean
  invited?: boolean
  error?: string
}

interface Props {
  courseId: string
  members: Member[]
  invitations: Invitation[]
  currentUserRole: 'instructor' | 'admin'
}

function RolePill({ role }: { role: string }) {
  const styles: Record<string, string> = {
    student: 'bg-teal-light text-teal-primary',
    instructor: 'bg-purple-100 text-purple-700',
    admin: 'bg-orange-100 text-orange-700',
    observer: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${styles[role] ?? 'bg-border text-muted-text'}`}>
      {role}
    </span>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function parseEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.includes('@'))
}

export default function PeopleManager({ courseId, members, invitations, currentUserRole }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Add form
  const [emailsRaw, setEmailsRaw] = useState('')
  const [role, setRole] = useState<'student' | 'instructor'>('student')
  const [adding, setAdding] = useState(false)
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null)

  // Per-row action status
  const [actionStatus, setActionStatus] = useState<{ id: string; type: 'success' | 'error'; message: string } | null>(null)

  // Role editing
  const [editingRoleFor, setEditingRoleFor] = useState<string | null>(null)
  const [savingRole, setSavingRole] = useState(false)

  const activeMembers = members.filter(m => m.role !== 'observer')
  const observerMembers = members.filter(m => m.role === 'observer')

  function renderMemberDesktopRow(member: Member, muted = false) {
    return (
      <tr key={member.userId} className={`bg-background ${muted ? 'opacity-60' : ''}`}>
        <td className="px-4 py-3 text-dark-text">{member.name || '—'}</td>
        <td className="px-4 py-3 text-muted-text">{member.email}</td>
        <td className="px-4 py-3">
          {editingRoleFor === member.userId ? (
            <div className="flex items-center gap-2">
              <select
                defaultValue={member.role}
                disabled={savingRole}
                autoFocus
                onChange={(e) => handleRoleChange(member.userId, e.target.value as Role)}
                onBlur={() => setEditingRoleFor(null)}
                className="border border-border rounded px-2 py-0.5 text-xs bg-surface text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                aria-label={`Change role for ${member.name || member.email}`}
              >
                <option value="student">Student</option>
                <option value="observer">Observer</option>
                <option value="instructor">Instructor</option>
                {currentUserRole === 'admin' && <option value="admin">Admin</option>}
              </select>
            </div>
          ) : (
            <button
              onClick={() => setEditingRoleFor(member.userId)}
              className="group flex items-center gap-1.5"
              aria-label={`Edit role for ${member.name || member.email}`}
              title="Click to change role"
            >
              <RolePill role={member.role} />
              <span className="text-xs text-muted-text opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
            </button>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={() => handleRemove(member.userId)}
            disabled={isPending}
            aria-label={`Remove ${member.name || member.email} from course`}
            className="text-muted-text hover:text-red-500 disabled:opacity-50 transition-colors"
          >
            <TrashIcon />
          </button>
          {actionStatus?.id === member.userId && (
            <span className={`ml-2 text-xs ${actionStatus.type === 'error' ? 'text-red-600' : 'text-teal-primary'}`}>
              {actionStatus.message}
            </span>
          )}
        </td>
      </tr>
    )
  }

  function renderMemberMobileCard(member: Member, muted = false) {
    return (
      <div key={member.userId} className={`bg-background px-4 py-3 flex items-center justify-between gap-3 ${muted ? 'opacity-60' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-dark-text truncate">{member.name || '—'}</span>
            <RolePill role={member.role} />
          </div>
          <p className="text-xs text-muted-text mt-0.5 truncate">{member.email}</p>
        </div>
        <button
          onClick={() => handleRemove(member.userId)}
          disabled={isPending}
          aria-label={`Remove ${member.name || member.email} from course`}
          className="text-muted-text hover:text-red-500 disabled:opacity-50 transition-colors shrink-0"
        >
          <TrashIcon />
        </button>
      </div>
    )
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setBulkResults(null)
    const emails = parseEmails(emailsRaw)
    if (emails.length === 0) return
    setAdding(true)
    const results = await bulkAddPeopleToCourse(courseId, emails, role)
    setAdding(false)
    setBulkResults(results)
    setEmailsRaw('')
    startTransition(() => router.refresh())
  }

  async function handleRoleChange(userId: string, newRole: Role) {
    setSavingRole(true)
    setActionStatus(null)
    const result = await updateEnrollmentRole(courseId, userId, newRole)
    setSavingRole(false)
    setEditingRoleFor(null)
    if (result.error) {
      setActionStatus({ id: userId, type: 'error', message: result.error })
    } else {
      startTransition(() => router.refresh())
    }
  }

  async function handleResend(invitationId: string, inviteEmail: string) {
    setActionStatus(null)
    const result = await resendInvite(invitationId)
    if (result.error) {
      setActionStatus({ id: invitationId, type: 'error', message: result.error })
    } else {
      setActionStatus({ id: invitationId, type: 'success', message: `Invite resent to ${inviteEmail}.` })
      startTransition(() => router.refresh())
    }
  }

  async function handleRevoke(invitationId: string) {
    setActionStatus(null)
    const result = await revokeInvite(invitationId)
    if (result.error) {
      setActionStatus({ id: invitationId, type: 'error', message: result.error })
    } else {
      startTransition(() => router.refresh())
    }
  }

  async function handleRemove(userId: string) {
    setActionStatus(null)
    const result = await removePersonFromCourse(courseId, userId)
    if (result.error) {
      setActionStatus({ id: userId, type: 'error', message: result.error })
    } else {
      startTransition(() => router.refresh())
    }
  }

  const parsedCount = parseEmails(emailsRaw).length

  return (
    <div className="space-y-10">
      {/* Add People Form */}
      <section>
        <h2 className="text-base font-semibold text-dark-text mb-4">Add People</h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <textarea
            placeholder={"Enter email addresses, one per line (or comma-separated)\njane@example.com\njohn@example.com"}
            value={emailsRaw}
            onChange={(e) => { setEmailsRaw(e.target.value); setBulkResults(null) }}
            rows={4}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-dark-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-teal-primary resize-none"
            aria-label="Email addresses"
          />
          <div className="flex items-center gap-3">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'student' | 'instructor')}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-surface text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
              aria-label="Role"
            >
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
            </select>
            <button
              type="submit"
              disabled={adding || isPending || parsedCount === 0}
              className="bg-teal-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-primary/90 disabled:opacity-50 transition-colors"
            >
              {adding
                ? 'Processing…'
                : parsedCount > 1
                  ? `Add ${parsedCount} people`
                  : 'Add'}
            </button>
          </div>
        </form>

        {/* Bulk results */}
        {bulkResults && bulkResults.length > 0 && (
          <div className="mt-4 border border-border rounded-lg overflow-hidden" role="status" aria-live="polite">
            <div className="bg-surface border-b border-border px-4 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide">
              Results — {bulkResults.filter(r => !r.error).length} of {bulkResults.length} succeeded
            </div>
            <ul className="divide-y divide-border">
              {bulkResults.map((r) => (
                <li key={r.email} className="flex items-center gap-3 px-4 py-2.5 text-sm bg-background">
                  <span className={`shrink-0 text-base ${r.error ? 'text-red-500' : 'text-teal-primary'}`}>
                    {r.error ? '✗' : '✓'}
                  </span>
                  <span className="text-dark-text truncate">{r.email}</span>
                  <span className="ml-auto text-xs text-muted-text shrink-0">
                    {r.error ?? (r.added ? 'Added' : 'Invite sent')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Members Table */}
      <section>
        <h2 className="text-base font-semibold text-dark-text mb-4">
          Members <span className="text-muted-text font-normal">({activeMembers.length})</span>
        </h2>
        {activeMembers.length === 0 ? (
          <p className="text-sm text-muted-text">No members yet.</p>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden flex flex-col divide-y divide-border border border-border rounded-lg overflow-hidden">
              {activeMembers.map((member) => renderMemberMobileCard(member))}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-muted-text">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-text">Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-text">Role</th>
                    <th className="sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeMembers.map((member) => renderMemberDesktopRow(member))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Observers Section */}
      {observerMembers.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-dark-text mb-1">Observers</h2>
          <p className="text-xs text-muted-text mb-4">on leave / paused</p>
          {/* Mobile card list */}
          <div className="sm:hidden flex flex-col divide-y divide-border border border-border rounded-lg overflow-hidden">
            {observerMembers.map((member) => renderMemberMobileCard(member, true))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-muted-text">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-text">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-text">Role</th>
                  <th className="sr-only">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {observerMembers.map((member) => renderMemberDesktopRow(member, true))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Pending Invitations Table */}
      {invitations.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-dark-text mb-4">
            Pending Invitations <span className="text-muted-text font-normal">({invitations.length})</span>
          </h2>
          <>
            {/* Mobile card list */}
            <div className="sm:hidden flex flex-col divide-y divide-border border border-border rounded-lg overflow-hidden">
              {invitations.map((inv) => (
                <div key={inv.id} className="bg-background px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-dark-text truncate">{inv.email}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <RolePill role={inv.role} />
                        <span className="text-xs text-muted-text">
                          {inv.resent_at ? `Resent ${formatDate(inv.resent_at)}` : formatDate(inv.invited_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleResend(inv.id, inv.email)}
                        disabled={isPending}
                        className="text-xs font-medium text-teal-primary hover:underline disabled:opacity-50"
                      >
                        Resend
                      </button>
                      <button
                        onClick={() => handleRevoke(inv.id)}
                        disabled={isPending}
                        aria-label={`Revoke invite for ${inv.email}`}
                        className="text-muted-text hover:text-red-500 disabled:opacity-50 transition-colors"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                  {actionStatus?.id === inv.id && (
                    <p className={`text-xs mt-1 ${actionStatus.type === 'error' ? 'text-red-600' : 'text-teal-primary'}`}>
                      {actionStatus.message}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-muted-text">Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-text">Role</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-text">Sent</th>
                    <th className="sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="bg-background">
                      <td className="px-4 py-3 text-muted-text">{inv.email}</td>
                      <td className="px-4 py-3">
                        <RolePill role={inv.role} />
                      </td>
                      <td className="px-4 py-3 text-muted-text text-xs">
                        {inv.resent_at
                          ? `Resent ${formatDate(inv.resent_at)}`
                          : formatDate(inv.invited_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleResend(inv.id, inv.email)}
                            disabled={isPending}
                            className="text-xs font-medium text-teal-primary hover:underline disabled:opacity-50"
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => handleRevoke(inv.id)}
                            disabled={isPending}
                            aria-label={`Revoke invite for ${inv.email}`}
                            className="text-muted-text hover:text-red-500 disabled:opacity-50 transition-colors"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                        {actionStatus?.id === inv.id && (
                          <p className={`text-xs mt-1 text-right ${actionStatus.type === 'error' ? 'text-red-600' : 'text-teal-primary'}`}>
                            {actionStatus.message}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        </section>
      )}
    </div>
  )
}
