import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((to: string) => { throw new Error(`REDIRECT:${to}`) }),
}))
vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn() }))
vi.mock('@/lib/attendance-access', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/attendance-access')>()),
  getAttendanceAccess: vi.fn(),
}))
vi.mock('@/lib/airtable', () => ({
  fetchStudentAttendance: vi.fn(),
  fetchStudentAttendanceById: vi.fn(),
  fetchStudentProfile: vi.fn(),
  fetchStudentProfileById: vi.fn(),
  fetchAttendanceCourses: vi.fn(),
  resolveAirtableStudentIdByEmail: vi.fn(),
}))
vi.mock('@/components/ui/StudentTopNav', () => ({ default: () => null }))
vi.mock('@/components/ui/InstructorTopNav', () => ({ default: () => null }))
vi.mock('@/app/student/attendance/AttendanceView', () => ({ default: () => null }))

import StudentAttendancePage from '@/app/student/attendance/page'
import AttendanceView from '@/app/student/attendance/AttendanceView'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAttendanceAccess } from '@/lib/attendance-access'
import * as airtable from '@/lib/airtable'
import type { ReactElement, ReactNode } from 'react'

const BACKEND = { id: 'recBE', name: 'Backend Jan 2026', startDate: '2026-01-05', endDate: '2026-04-30' }
const ITP = { id: 'recITP', name: 'ITP Sep 2025', startDate: '2025-09-01', endDate: '2025-12-15' }
const FRONTEND = { id: 'recFE', name: 'Frontend Jan 2026', startDate: '2026-01-05', endDate: '2026-04-30' }

function signedInAs(role: string) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'me', email: 'me@x.org' } } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { name: 'Me', role, airtable_student_id: null } }) }) }) }),
  } as never)
}

function student(enrolledCourseIds: string[], currentCourse: string | null) {
  vi.mocked(airtable.fetchStudentProfileById).mockResolvedValue({ preferredName: 'Sam', currentCourse, enrolledCourseIds })
  vi.mocked(airtable.fetchAttendanceCourses).mockResolvedValue([BACKEND, FRONTEND, ITP])
  vi.mocked(airtable.fetchStudentAttendanceById).mockResolvedValue([
    { id: 'r1', date: '2026-02-02', blockA: 'Present', blockB: null, blockC: null, blockD: null },
    { id: 'r2', date: '2025-10-01', blockA: 'Absent', blockB: null, blockC: null, blockD: null },
  ])
}

const open = (params: Record<string, string>) => StudentAttendancePage({ searchParams: Promise.resolve(params) })

// Finds the props AttendanceView was rendered with in the returned element tree.
function attendanceProps(node: ReactNode): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) return node.map(attendanceProps).find(Boolean) ?? null
  const el = node as ReactElement<{ children?: ReactNode }>
  if (el.type === AttendanceView) return el.props as Record<string, unknown>
  return attendanceProps(el.props?.children)
}

beforeEach(() => vi.clearAllMocks())

describe('/student/attendance — TA viewing a student', () => {
  const ta = { allClasses: false as const, classNames: ['Backend Jan 2026'] }

  it("lets a TA open a student in a class they TA, showing only that class's records", async () => {
    signedInAs('student')
    vi.mocked(getAttendanceAccess).mockResolvedValue(ta)
    student(['recBE', 'recITP'], 'Backend Jan 2026')
    const props = attendanceProps(await open({ studentId: 'S12', as: 'Sam', course: 'Backend Jan 2026' }))
    expect(props?.courses).toEqual([BACKEND])
    expect((props?.records as { id: string }[]).map(r => r.id)).toEqual(['r1'])
    expect(props?.defaultCourseName).toBe('Backend Jan 2026')
  })

  it("bounces a TA from a class they don't TA, before loading anything", async () => {
    signedInAs('student')
    vi.mocked(getAttendanceAccess).mockResolvedValue(ta)
    await expect(open({ studentId: 'S12', as: 'Sam', course: 'Frontend Jan 2026' })).rejects.toThrow('REDIRECT:/student/attendance')
    expect(airtable.fetchStudentProfileById).not.toHaveBeenCalled()
  })

  it('bounces a TA when the student is not in that class', async () => {
    signedInAs('student')
    vi.mocked(getAttendanceAccess).mockResolvedValue(ta)
    student(['recFE'], 'Frontend Jan 2026')
    await expect(open({ studentId: 'S99', as: 'Other', course: 'Backend Jan 2026' })).rejects.toThrow('REDIRECT:/instructor/attendance')
  })

  it('bounces a TA looking a student up by name only', async () => {
    signedInAs('student')
    vi.mocked(getAttendanceAccess).mockResolvedValue(ta)
    await expect(open({ as: 'Sam', course: 'Backend Jan 2026' })).rejects.toThrow('REDIRECT:/student/attendance')
  })

  it('bounces a student who is not a TA anywhere', async () => {
    signedInAs('student')
    vi.mocked(getAttendanceAccess).mockResolvedValue(null)
    await expect(open({ studentId: 'S12', course: 'Backend Jan 2026' })).rejects.toThrow('REDIRECT:/student/attendance')
  })

  it('still gives staff the full, unfiltered view', async () => {
    signedInAs('instructor')
    student(['recFE'], 'Frontend Jan 2026')
    const props = attendanceProps(await open({ studentId: 'S12', as: 'Sam', course: 'Backend Jan 2026' }))
    expect(props?.courses).toEqual([BACKEND, FRONTEND, ITP])
    expect((props?.records as unknown[]).length).toBe(2)
    expect(getAttendanceAccess).not.toHaveBeenCalled()
  })
})
