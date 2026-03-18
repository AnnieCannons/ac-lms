'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateUserRole, removeStudentUser, deleteStaffMember } from '@/lib/people-actions'

type Role = 'student' | 'instructor' | 'admin'

interface StudentEntry {
  userId: string
  name: string
  email: string
  courses: { id: string; name: string }[]
}

interface StaffMember {
  id: string
  name: string | null
  email: string
  role: Role
}

interface Props {
  allStudents: StudentEntry[]
  staff: StaffMember[]
  currentUserRole: 'instructor' | 'admin'
}

function RolePill({ role }: { role: string }) {
  const styles: Record<string, string> = {
    student: 'bg-teal-light text-teal-primary',
    instructor: 'bg-purple-100 text-purple-700',
    admin: 'bg-orange-100 text-orange-700',
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

export default function AllUsersView({ allStudents, staff, currentUserRole }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingRoleFor, setEditingRoleFor] = useState<string | null>(null)
  const [savingRole, setSavingRole] = useState(false)
  const [roleError, setRoleError] = useState<{ id: string; message: string } | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string; type: 'student' | 'staff' } | null>(null)

  async function handleRoleChange(userId: string, newRole: Role) {
    setSavingRole(true)
    setRoleError(null)
    const result = await updateUserRole(userId, newRole)
    setSavingRole(false)
    setEditingRoleFor(null)
    if (result.error) {
      setRoleError({ id: userId, message: result.error })
    } else {
      startTransition(() => router.refresh())
    }
  }

  async function handleRemoveStudent(userId: string) {
    setRemoveError(null)
    setRemovingId(userId)
    setConfirmRemove(null)
    const result = await removeStudentUser(userId)
    setRemovingId(null)
    if (result.error) {
      setRemoveError(result.error)
    } else {
      startTransition(() => router.refresh())
    }
  }

  async function handleDeleteStaff(userId: string) {
    setRemoveError(null)
    setRemovingId(userId)
    setConfirmRemove(null)
    const result = await deleteStaffMember(userId)
    setRemovingId(null)
    if (result.error) {
      setRemoveError(result.error)
    } else {
      startTransition(() => router.refresh())
    }
  }

  const CoursePills = ({ courses }: { courses: { id: string; name: string }[] }) => (
    <div className="flex flex-wrap gap-1">
      {courses.map((c) => (
        <span key={c.id} className="text-xs font-medium px-2 py-0.5 rounded bg-teal-light text-teal-primary whitespace-nowrap">
          {c.name}
        </span>
      ))}
      {courses.length === 0 && <span className="text-xs text-muted-text">—</span>}
    </div>
  )

  return (
    <div className="space-y-10">
      {/* Confirm dialog modal */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface rounded-2xl border border-border shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-dark-text mb-2">Remove {confirmRemove.name}?</h3>
            <p className="text-sm text-muted-text mb-6">
              {confirmRemove.type === 'student'
                ? 'This will remove them from all courses. Their account will remain.'
                : 'This will remove their staff account and all course enrollments. This cannot be undone.'}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmRemove(null)}
                className="text-sm font-medium text-muted-text hover:text-dark-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmRemove.type === 'student'
                  ? handleRemoveStudent(confirmRemove.id)
                  : handleDeleteStaff(confirmRemove.id)
                }
                disabled={removingId === confirmRemove.id}
                className="text-sm font-semibold px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {removingId === confirmRemove.id ? 'Removing…' : 'Yes, remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructors & Admins */}
      <section>
        <h2 className="text-base font-semibold text-dark-text mb-4">
          Instructors &amp; Admins <span className="text-muted-text font-normal">({staff.length})</span>
        </h2>
        {removeError && <p className="text-xs text-red-600 mb-3">{removeError}</p>}
        {staff.length === 0 ? (
          <p className="text-sm text-muted-text">No instructors yet.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold text-muted-text">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-text">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-text">Role</th>
                  {currentUserRole === 'admin' && <th className="sr-only">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staff.map((member) => (
                  <tr key={member.id} className="bg-background">
                    <td className="px-4 py-3 text-dark-text">{member.name || '—'}</td>
                    <td className="px-4 py-3 text-muted-text">{member.email}</td>
                    <td className="px-4 py-3">
                      {currentUserRole === 'admin' && editingRoleFor === member.id ? (
                        <select
                          defaultValue={member.role}
                          disabled={savingRole}
                          autoFocus
                          onChange={(e) => handleRoleChange(member.id, e.target.value as Role)}
                          onBlur={() => setEditingRoleFor(null)}
                          className="border border-border rounded px-2 py-0.5 text-xs bg-surface text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-primary"
                          aria-label={`Change role for ${member.name || member.email}`}
                        >
                          <option value="instructor">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <button
                          onClick={() => currentUserRole === 'admin' && setEditingRoleFor(member.id)}
                          className={`group flex items-center gap-1.5 ${currentUserRole !== 'admin' ? 'cursor-default' : ''}`}
                          aria-label={currentUserRole === 'admin' ? `Edit role for ${member.name || member.email}` : undefined}
                          title={currentUserRole === 'admin' ? 'Click to change role' : undefined}
                        >
                          <RolePill role={member.role} />
                          {currentUserRole === 'admin' && (
                            <span className="text-xs text-muted-text opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                          )}
                        </button>
                      )}
                      {roleError?.id === member.id && (
                        <p className="text-xs text-red-600 mt-1">{roleError.message}</p>
                      )}
                    </td>
                    {currentUserRole === 'admin' && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setConfirmRemove({ id: member.id, name: member.name || member.email, type: 'staff' })}
                          disabled={isPending}
                          aria-label={`Remove ${member.name || member.email}`}
                          className="text-muted-text hover:text-red-500 disabled:opacity-50 transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* All Students */}
      <section>
        <h2 className="text-base font-semibold text-dark-text mb-4">
          Students <span className="text-muted-text font-normal">({allStudents.length} total)</span>
        </h2>
        {allStudents.length === 0 ? (
          <p className="text-sm text-muted-text">No students enrolled yet.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface border-b border-border">
                    <th className="text-left px-4 py-3 font-semibold text-muted-text">Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-text">Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-text">Enrolled In</th>
                    <th className="sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allStudents.map((student) => (
                    <tr key={student.userId} className="bg-background">
                      <td className="px-4 py-3 text-dark-text">{student.name || '—'}</td>
                      <td className="px-4 py-3 text-muted-text">{student.email}</td>
                      <td className="px-4 py-3"><CoursePills courses={student.courses} /></td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setConfirmRemove({ id: student.userId, name: student.name || student.email, type: 'student' })}
                          disabled={isPending}
                          aria-label={`Remove ${student.name || student.email}`}
                          className="text-muted-text hover:text-red-500 disabled:opacity-50 transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden flex flex-col divide-y divide-border border border-border rounded-lg overflow-hidden">
              {allStudents.map((student) => (
                <div key={student.userId} className="bg-background px-4 py-3 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-text">{student.name || '—'}</p>
                    <p className="text-xs text-muted-text mt-0.5">{student.email}</p>
                    <div className="mt-1.5"><CoursePills courses={student.courses} /></div>
                  </div>
                  <button
                    onClick={() => setConfirmRemove({ id: student.userId, name: student.name || student.email, type: 'student' })}
                    aria-label={`Remove ${student.name || student.email}`}
                    className="text-muted-text hover:text-red-500 transition-colors shrink-0 mt-0.5"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
