import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AttendanceView from '@/app/student/attendance/AttendanceView'
import type { AttendanceRecord, AttendanceCourse } from '@/lib/airtable'

const course: AttendanceCourse = { id: 'c1', name: 'ITP Fall 2026', startDate: '2026-09-01', endDate: '2026-12-01' }

const records: AttendanceRecord[] = [
  { id: 'r1', date: '2026-10-05', blockA: 'On Time', blockB: 'Absent (20+ minutes)', blockC: 'Excused Absence', blockD: 'Excused Absence' },
  { id: 'r2', date: '2026-10-06', blockA: 'Holiday', blockB: 'Holiday', blockC: 'Holiday', blockD: 'Holiday' },
]

const statValue = (label: string) => screen.getByText(label).nextElementSibling?.textContent

describe('AttendanceView excused absences and holidays', () => {
  it('shows Excused Absence and Holiday pills', () => {
    render(<AttendanceView records={records} profile={null} courses={[course]} />)
    expect(screen.getByText('Block C: Excused Absence')).toBeInTheDocument()
    expect(screen.getByText('Block A: Holiday')).toBeInTheDocument()
    expect(screen.queryByText('Block C: On time')).not.toBeInTheDocument()
  })

  it('leaves them out of every count', () => {
    render(<AttendanceView records={records} profile={null} courses={[course]} />)
    expect(statValue('On Time Blocks')).toBe('1')
    expect(statValue('Absent Blocks')).toBe('1')
    // 1 absent out of 2 counted blocks, not out of 8
    expect(statValue('% Missed')).toBe('50%')
  })
})
