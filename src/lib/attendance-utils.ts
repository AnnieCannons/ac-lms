import type { AttendanceRecord, AttendanceCourse } from '@/lib/airtable'

export function filterRecordsByCourse(records: AttendanceRecord[], course: AttendanceCourse): AttendanceRecord[] {
  const start = new Date(course.startDate)
  const end = course.endDate ? new Date(course.endDate) : new Date()
  end.setHours(23, 59, 59, 999)
  return records.filter(r => {
    if (!r.date) return false
    const d = new Date(r.date)
    return d >= start && d <= end
  })
}
