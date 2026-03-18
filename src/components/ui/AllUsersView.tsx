'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateUserRole, removeStudentUser } from '@/lib/people-actions'

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
  const [confirmRemove, setConfirmRemove] = useState<StudentEntry | null>(null)

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

  return (
    <div className="space-y-10">
      {/* Instructors & Admins */}
      <section>
        <h2 className="text-base font-semibold text-dark-text mb-4">
          Instructors &amp; Admins <span className="text-muted-text font-normal">({staff.length})</span>
        </h2>
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
        {removeError && <p className="text-xs text-red-600 mb-3">{removeError}</p>}
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
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {student.courses.map((c) => (
                            <span key={c.id} className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-light text-teal-primary">
                              {c.name}
                            </span>
                          ))}
                          {student.courses.length === 0 && (
                            <span className="text-xs text-muted-text">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {confirmRemove?.userId === student.userId ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-muted-text">Remove from all courses?</span>
                            <button
                              onClick={() => handleRemoveStudent(student.userId)}
                              disabled={removingId === student.userId || isPending}
                              className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                            >
                              {removingId === student.userId ? 'Removing…' : 'Yes, remove'}
                            </button>
                            <button
                              onClick={() => setConfirmRemove(null)}
                              className="text-xs text-muted-text hover:text-dark-text"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRemove(student)}
                            disabled={isPending}
                            aria-label={`Remove ${student.name || student.email}`}
                            className="text-muted-text hover:text-red-500 disabled:opacity-50 transition-colors"
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden flex flex-col divide-y divide-border border border-border rounded-lg overflow-hidden">
              {allStudents.map((student) => (
                <div key={student.userId} className="bg-background px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark-text">{student.name || '—'}</p>
                      <p className="text-xs text-muted-text mt-0.5">{student.email}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {student.courses.map((c) => (
                          <span key={c.id} className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-light text-teal-primary">
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    {confirmRemove?.userId === student.userId ? (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-muted-text">Remove from all courses?</span>
                        <div className="flex gap-2">
                          <button onClick={() => handleRemoveStudent(student.userId)} disabled={removingId === student.userId} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
                            {removingId === student.userId ? 'Removing…' : 'Yes'}
                          </button>
                          <button onClick={() => setConfirmRemove(null)} className="text-xs text-muted-text">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemove(student)}
                        aria-label={`Remove ${student.name || student.email}`}
                        className="text-muted-text hover:text-red-500 transition-colors shrink-0 mt-0.5"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
