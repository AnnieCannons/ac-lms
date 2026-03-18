'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateEnrollmentRole, resendInvite, revokeInvite, removePersonFromCourse, toggleInstructorCourse, deleteStaffMember } from '@/lib/people-actions'

type Role = 'student' | 'instructor' | 'admin' | 'observer' | 'ta'

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

interface Props {
  courseId: string
  members: Member[]
  invitations: Invitation[]
  currentUserRole: 'instructor' | 'admin'
  instructors: { id: string; name: string; email: string }[]
  allCourses: { id: string; name: string }[]
  instructorCourseMap: Record<string, string[]>
}

function RolePill({ role }: { role: string }) {
  const styles: Record<string, string> = {
    student: 'bg-teal-light text-teal-primary',
    instructor: 'bg-purple-100 text-purple-700',
    admin: 'bg-orange-100 text-orange-700',
    observer: 'bg-gray-100 text-gray-500',
    ta: 'badge-ta',
  }
  const labels: Record<string, string> = { ta: 'TA', instructor: 'Staff' }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${styles[role] ?? 'bg-border text-muted-text'}`}>
      {labels[role] ?? role}
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

function InstructorSection({
  instructors,
  allCourses,
  instructorCourseMap,
  currentUserRole,
}: {
  instructors: { id: string; name: string; email: string }[]
  allCourses: { id: string; name: string }[]
  instructorCourseMap: Record<string, string[]>
  currentUserRole: 'instructor' | 'admin'
}) {
  const router = useRouter()
  const [assignments, setAssignments] = useState<Record<string, string[]>>(
    Object.fromEntries(instructors.map(i => [i.id, instructorCourseMap[i.id] ?? []]))
  )
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const courseNameMap = Object.fromEntries(allCourses.map(c => [c.id, c.name]))

  function addCourse(instructorId: string, courseId: string) {
    if (!courseId) return
    setAssignments(prev => ({ ...prev, [instructorId]: [...(prev[instructorId] ?? []), courseId] }))
    setAddingFor(null)
    startTransition(async () => { await toggleInstructorCourse(instructorId, courseId, true) })
  }

  function removeCourse(instructorId: string, courseId: string) {
    setAssignments(prev => ({ ...prev, [instructorId]: (prev[instructorId] ?? []).filter(id => id !== courseId) }))
    startTransition(async () => { await toggleInstructorCourse(instructorId, courseId, false) })
  }

  async function handleDelete(instructorId: string) {
    setDeleteError(null)
    setDeletingId(instructorId)
    const result = await deleteStaffMember(instructorId)
    setDeletingId(null)
    if (result.error) {
      setDeleteError(result.error)
    } else {
      startTransition(() => router.refresh())
    }
  }

  if (instructors.length === 0) return null

  return (
    <section>
      <h2 className="text-base font-semibold text-dark-text mb-4">Staff</h2>
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Desktop table */}
        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-muted-text">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-text">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-text">Teaching</th>
                {currentUserRole === 'admin' && <th className="sr-only">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {instructors.map(instructor => {
                const assignedIds = assignments[instructor.id] ?? []
                const unassigned = allCourses.filter(c => !assignedIds.includes(c.id))
                return (
                  <tr key={instructor.id} className="bg-background">
                    <td className="px-4 py-3 text-dark-text">{instructor.name || '—'}</td>
                    <td className="px-4 py-3 text-muted-text">{instructor.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {assignedIds.map(courseId => (
                          <span key={courseId} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-teal-light text-teal-primary">
                            {courseNameMap[courseId] ?? '…'}
                            <button type="button" onClick={() => removeCourse(instructor.id, courseId)} className="hover:opacity-60 leading-none" aria-label={`Remove ${courseNameMap[courseId]}`}>×</button>
                          </span>
                        ))}
                        {assignedIds.length === 0 && unassigned.length > 0 && (
                          addingFor === instructor.id ? (
                            <select
                              autoFocus
                              defaultValue=""
                              onChange={e => addCourse(instructor.id, e.target.value)}
                              onBlur={() => setAddingFor(null)}
                              className="text-xs bg-background border border-border rounded-lg px-2 py-0.5 text-dark-text focus:outline-none focus:border-teal-primary"
                            >
                              <option value="" disabled>Pick a course…</option>
                              {unassigned.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          ) : (
                            <button type="button" onClick={() => setAddingFor(instructor.id)} className="text-xs text-muted-text hover:text-teal-primary border border-dashed border-border hover:border-teal-primary/50 rounded-full px-2 py-0.5 transition-colors">
                              + course
                            </button>
                          )
                        )}
                      </div>
                    </td>
                    {currentUserRole === 'admin' && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(instructor.id)}
                          disabled={deletingId === instructor.id}
                          aria-label={`Remove ${instructor.name || instructor.email} from staff`}
                          className="text-muted-text hover:text-red-500 disabled:opacity-50 transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {/* Mobile cards */}
        <div className="sm:hidden flex flex-col divide-y divide-border">
          {instructors.map(instructor => {
            const assignedIds = assignments[instructor.id] ?? []
            const unassigned = allCourses.filter(c => !assignedIds.includes(c.id))
            return (
              <div key={instructor.id} className="bg-background px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-dark-text">{instructor.name || '—'}</p>
                    <p className="text-xs text-muted-text mt-0.5">{instructor.email}</p>
                  </div>
                  {currentUserRole === 'admin' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(instructor.id)}
                      disabled={deletingId === instructor.id}
                      aria-label={`Remove ${instructor.name || instructor.email} from staff`}
                      className="text-muted-text hover:text-red-500 disabled:opacity-50 transition-colors shrink-0 mt-0.5"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {assignedIds.map(courseId => (
                    <span key={courseId} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-teal-light text-teal-primary">
                      {courseNameMap[courseId] ?? '…'}
                      <button type="button" onClick={() => removeCourse(instructor.id, courseId)} className="hover:opacity-60">×</button>
                    </span>
                  ))}
                  {assignedIds.length === 0 && unassigned.length > 0 && (
                    addingFor === instructor.id ? (
                      <select autoFocus defaultValue="" onChange={e => addCourse(instructor.id, e.target.value)} onBlur={() => setAddingFor(null)} className="text-xs bg-background border border-border rounded-lg px-2 py-0.5 text-dark-text">
                        <option value="" disabled>Pick a course…</option>
                        {unassigned.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : (
                      <button type="button" onClick={() => setAddingFor(instructor.id)} className="text-xs text-muted-text hover:text-teal-primary border border-dashed border-border rounded-full px-2 py-0.5 transition-colors">
                        + course
                      </button>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {deleteError && <p className="text-xs text-red-600 mt-2">{deleteError}</p>}
    </section>
  )
}

export default function PeopleManager({ courseId, members, invitations, currentUserRole, instructors, allCourses, instructorCourseMap }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Per-row action status
  const [actionStatus, setActionStatus] = useState<{ id: string; type: 'success' | 'error'; message: string } | null>(null)

  // Remove confirmation + loading state
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string } | null>(null)
  const [removing, setRemoving] = useState(false)

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
                <option value="ta">TA</option>
                <option value="observer">Observer</option>
                <option value="instructor">Staff</option>
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
            onClick={() => setConfirmRemove({ userId: member.userId, name: member.name || member.email })}
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
    setConfirmRemove(null)
    setRemoving(true)
    const result = await removePersonFromCourse(courseId, userId)
    if (result.error) {
      setRemoving(false)
      setActionStatus({ id: userId, type: 'error', message: result.error })
    } else {
      startTransition(() => { router.refresh(); setRemoving(false) })
    }
  }

  return (
    <div className="space-y-10">
      {/* Top progress bar during remove */}
      {removing && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-border overflow-hidden">
          <div className="h-full bg-teal-primary animate-[progress_1.5s_ease-in-out_infinite]" style={{ width: '40%', animation: 'slide 1.2s ease-in-out infinite' }} />
          <style>{`@keyframes slide { 0% { transform: translateX(-100%) scaleX(1); } 50% { transform: translateX(100%) scaleX(2); } 100% { transform: translateX(300%) scaleX(1); } }`}</style>
        </div>
      )}

      {/* Remove from course confirmation modal */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface rounded-2xl border border-border shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-dark-text mb-2">Remove {confirmRemove.name}?</h3>
            <p className="text-sm text-muted-text mb-6">
              This will remove them from this course only. Their account and any other course enrollments will remain untouched.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmRemove(null)}
                className="text-sm font-medium text-muted-text hover:text-dark-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemove(confirmRemove.userId)}
                disabled={isPending}
                className="text-sm font-semibold px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Yes, remove from course
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Learners */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-dark-text">
            Learners <span className="text-muted-text font-normal">({activeMembers.length})</span>
          </h2>
        </div>

        {activeMembers.length === 0 ? (
          <p className="text-sm text-muted-text">No members yet.</p>
        ) : (
          <>
            <div className="sm:hidden flex flex-col divide-y divide-border border border-border rounded-lg overflow-hidden">
              {activeMembers.map((member) => renderMemberMobileCard(member))}
            </div>
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

      {/* Observers */}
      {observerMembers.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-dark-text mb-1">Observers</h2>
          <p className="text-xs text-muted-text mb-4">on leave / paused</p>
          <div className="sm:hidden flex flex-col divide-y divide-border border border-border rounded-lg overflow-hidden">
            {observerMembers.map((member) => renderMemberMobileCard(member, true))}
          </div>
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

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-dark-text mb-4">
            Pending Invitations <span className="text-muted-text font-normal">({invitations.length})</span>
          </h2>
          <>
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
                      <button onClick={() => handleResend(inv.id, inv.email)} disabled={isPending} className="text-xs font-medium text-teal-primary hover:underline disabled:opacity-50">Resend</button>
                      <button onClick={() => handleRevoke(inv.id)} disabled={isPending} aria-label={`Revoke invite for ${inv.email}`} className="text-muted-text hover:text-red-500 disabled:opacity-50 transition-colors"><TrashIcon /></button>
                    </div>
                  </div>
                  {actionStatus?.id === inv.id && (
                    <p className={`text-xs mt-1 ${actionStatus.type === 'error' ? 'text-red-600' : 'text-teal-primary'}`}>{actionStatus.message}</p>
                  )}
                </div>
              ))}
            </div>
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
                      <td className="px-4 py-3"><RolePill role={inv.role} /></td>
                      <td className="px-4 py-3 text-muted-text text-xs">
                        {inv.resent_at ? `Resent ${formatDate(inv.resent_at)}` : formatDate(inv.invited_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => handleResend(inv.id, inv.email)} disabled={isPending} className="text-xs font-medium text-teal-primary hover:underline disabled:opacity-50">Resend</button>
                          <button onClick={() => handleRevoke(inv.id)} disabled={isPending} aria-label={`Revoke invite for ${inv.email}`} className="text-muted-text hover:text-red-500 disabled:opacity-50 transition-colors"><TrashIcon /></button>
                        </div>
                        {actionStatus?.id === inv.id && (
                          <p className={`text-xs mt-1 text-right ${actionStatus.type === 'error' ? 'text-red-600' : 'text-teal-primary'}`}>{actionStatus.message}</p>
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

      <InstructorSection instructors={instructors} allCourses={allCourses} instructorCourseMap={instructorCourseMap} currentUserRole={currentUserRole} />

    </div>
  )
}
