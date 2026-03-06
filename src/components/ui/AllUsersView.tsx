'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateUserRole } from '@/lib/people-actions'

type Role = 'student' | 'instructor' | 'admin'

interface StudentEntry {
  userId: string
  name: string
  email: string
}

interface CourseStudents {
  courseId: string
  courseName: string
  students: StudentEntry[]
}

interface StaffMember {
  id: string
  name: string | null
  email: string
  role: Role
}

interface Props {
  studentsByCourse: CourseStudents[]
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

export default function AllUsersView({ studentsByCourse, staff, currentUserRole }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editingRoleFor, setEditingRoleFor] = useState<string | null>(null)
  const [savingRole, setSavingRole] = useState(false)
  const [roleError, setRoleError] = useState<{ id: string; message: string } | null>(null)

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

  const totalStudents = studentsByCourse.reduce((sum, c) => sum + c.students.length, 0)

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
                          <option value="instructor">Instructor</option>
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

      {/* Students by Course */}
      <section>
        <h2 className="text-base font-semibold text-dark-text mb-4">
          Students <span className="text-muted-text font-normal">({totalStudents} total)</span>
        </h2>
        {studentsByCourse.length === 0 ? (
          <p className="text-sm text-muted-text">No students enrolled yet.</p>
        ) : (
          <div className="space-y-6">
            {studentsByCourse.map((course) => (
              <div key={course.courseId}>
                <h3 className="text-sm font-semibold text-dark-text mb-2">
                  {course.courseName}
                  <span className="ml-2 text-muted-text font-normal">({course.students.length})</span>
                </h3>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface border-b border-border">
                        <th className="text-left px-4 py-2.5 font-semibold text-muted-text">Name</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-muted-text">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {course.students.map((student) => (
                        <tr key={student.userId} className="bg-background">
                          <td className="px-4 py-2.5 text-dark-text">{student.name || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-text">{student.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
