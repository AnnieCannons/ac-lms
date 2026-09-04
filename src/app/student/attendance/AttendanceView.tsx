'use client'
import { useState } from 'react'
import { CheckCircle, XCircle, Clock, AlertTriangle, Info } from 'lucide-react'
import type { AttendanceRecord, StudentProfile, AttendanceCourse } from '@/lib/airtable'

interface Props {
  records: AttendanceRecord[]
  profile: StudentProfile | null
  courses: AttendanceCourse[]
  defaultCourseName?: string
}


function filterRecordsByCourse(records: AttendanceRecord[], course: AttendanceCourse): AttendanceRecord[] {
  const start = new Date(course.startDate)
  const end = course.endDate ? new Date(course.endDate) : new Date()
  end.setHours(23, 59, 59, 999)
  return records.filter(r => {
    if (!r.date) return false
    const d = new Date(r.date)
    return d >= start && d <= end
  })
}

function defaultCourseId(
  records: AttendanceRecord[],
  courses: AttendanceCourse[],
  currentCourseName: string | null,
  overrideName?: string,
): string {
  if (!courses.length) return ''

  // 0. Instructor-provided course override (from ?course= param)
  if (overrideName) {
    const match = courses.find(c => c.name === overrideName)
    if (match) return match.id
  }

  // 1. Match by current course name from Airtable profile
  if (currentCourseName) {
    const match = courses.find(c => c.name === currentCourseName)
    if (match) return match.id
  }

  // 2. Fall back to the course containing the most recent attendance record (closed courses only)
  const mostRecent = records.find(r => r.date)
  if (mostRecent?.date) {
    const d = new Date(mostRecent.date)
    const match = courses.find(c => {
      if (!c.endDate) return false
      const start = new Date(c.startDate)
      const end = new Date(c.endDate)
      end.setHours(23, 59, 59, 999)
      return d >= start && d <= end
    })
    if (match) return match.id
  }

  return courses[0].id
}

function calcStats(records: AttendanceRecord[]) {
  let totalBlocks = 0, onTimeBlocks = 0, tardyBlocks = 0, absentBlocks = 0
  for (const r of records) {
    for (const block of [r.blockA, r.blockB, r.blockC, r.blockD]) {
      if (!block) continue
      totalBlocks++
      if (block === 'On Time') onTimeBlocks++
      else if (block.includes('Tardy')) tardyBlocks++
      else if (block.includes('Absent')) absentBlocks++
    }
  }
  const percentMissed = totalBlocks > 0 ? (absentBlocks / totalBlocks) * 100 : null
  return { totalBlocks, onTimeBlocks, tardyBlocks, absentBlocks, percentMissed }
}

type BlockStatus = 'onTime' | 'tardy' | 'absent'

function blockStatus(block: string | null): BlockStatus | null {
  if (!block) return null
  if (block.includes('Tardy')) return 'tardy'
  if (block.includes('Absent')) return 'absent'
  return 'onTime'
}

const pillClasses: Record<BlockStatus, string> = {
  onTime: 'bg-green-100 text-green-800',
  tardy: 'bg-yellow-100 text-yellow-800',
  absent: 'bg-red-100 text-red-800',
}

const pillLabels: Record<BlockStatus, string> = {
  onTime: 'On time',
  tardy: 'Tardy',
  absent: 'Absent',
}

function BlockPill({ label, status }: { label: string; status: BlockStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${pillClasses[status]}`}>
      {label}: {pillLabels[status]}
    </span>
  )
}

function formatDate(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const d = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function StatCard({
  label, value, icon: Icon, colorClass,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  colorClass: string
}) {
  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-text mb-1">{label}</p>
          <p className="text-2xl font-bold text-dark-text">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClass}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}

export default function AttendanceView({ records, profile, courses, defaultCourseName }: Props) {
  const enrolledIds = new Set(profile?.enrolledCourseIds ?? [])

  // Show courses the student is confirmed enrolled in (current or past),
  // plus fall back to date-range matching if no enrollment data is available.
  const relevantCourses = courses.filter(c => {
    const isCurrentCourse = c.name === profile?.currentCourse
    const isOverrideCourse = defaultCourseName ? c.name === defaultCourseName : false
    const isEnrolled = enrolledIds.has(c.id)
    const hasRecords = filterRecordsByCourse(records, c).length > 0
    if (enrolledIds.size > 0) {
      return isEnrolled || isCurrentCourse || isOverrideCourse
    }
    // No enrollment data — fall back to date-range heuristic
    return hasRecords || isCurrentCourse || isOverrideCourse
  })

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    () => defaultCourseId(records, relevantCourses, profile?.currentCourse ?? null, defaultCourseName),
  )

  const selectedCourse = relevantCourses.find(c => c.id === selectedCourseId) ?? null
  const filteredRecords = selectedCourse ? filterRecordsByCourse(records, selectedCourse) : records

  const stats = calcStats(filteredRecords)
  const percentMissed = stats.percentMissed

  const noData = filteredRecords.length === 0

  const sortedRecords = [...filteredRecords]
    .filter(r => !!r.date)
    .sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime())

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-dark-text">Attendance</h1>

        {relevantCourses.length > 0 && (
          <select
            value={selectedCourseId}
            onChange={e => setSelectedCourseId(e.target.value)}
            className="sm:w-72 px-4 py-2 border border-border rounded-lg bg-background text-dark-text text-sm focus:ring-2 focus:ring-teal-primary focus:border-transparent"
          >
            {relevantCourses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Attendance note */}
      <div className="p-4 rounded-xl border border-border bg-surface flex items-start gap-3 text-sm text-muted-text">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-teal-primary" />
        <p>
          These are the attendance records we have on file for you. If you have any questions about a record below, please check in with your instructor.
        </p>
      </div>

      {noData ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <p className="text-dark-text font-semibold mb-1">No attendance records</p>
          <p className="text-muted-text text-sm">No attendance data found for this course.</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="On Time Blocks" value={stats.onTimeBlocks} icon={CheckCircle} colorClass="bg-green-100 text-green-600" />
            <StatCard label="Tardy Blocks" value={stats.tardyBlocks} icon={Clock} colorClass="bg-yellow-100 text-yellow-600" />
            <StatCard label="Absent Blocks" value={stats.absentBlocks} icon={XCircle} colorClass="bg-red-100 text-red-600" />
            {percentMissed !== null && (
              <StatCard
                label="% Missed"
                value={`${Math.round(percentMissed)}%`}
                icon={AlertTriangle}
                colorClass="bg-gray-100 text-gray-600"
              />
            )}
          </div>

          {/* Records list */}
          <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
            <ul className="divide-y divide-border">
              {sortedRecords.map(r => (
                <li key={r.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <span className="text-sm font-medium text-dark-text sm:w-40 shrink-0">{formatDate(r.date as string)}</span>
                  <div className="flex flex-wrap gap-2">
                    {(['A', 'B', 'C', 'D'] as const).map(letter => {
                      const block = { A: r.blockA, B: r.blockB, C: r.blockC, D: r.blockD }[letter]
                      const status = blockStatus(block)
                      if (!status) return null
                      return <BlockPill key={letter} label={`Block ${letter}`} status={status} />
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
