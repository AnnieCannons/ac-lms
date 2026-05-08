'use client'
import { useState } from 'react'
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import type { AttendanceRecord, StudentProfile, AttendanceCourse } from '@/lib/airtable'

interface Props {
  records: AttendanceRecord[]
  profile: StudentProfile | null
  courses: AttendanceCourse[]
}


function filterRecordsByCourse(records: AttendanceRecord[], course: AttendanceCourse): AttendanceRecord[] {
  // Courses without an end date are still open/ongoing — can't define a closed range
  if (!course.endDate) return []
  const start = new Date(course.startDate)
  const end = new Date(course.endDate)
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
): string {
  if (!courses.length) return ''

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

function getZone(absentBlocks: number) {
  if (absentBlocks >= 23) return 'red' as const
  if (absentBlocks >= 12) return 'yellow' as const
  return 'green' as const
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

export default function AttendanceView({ records, profile, courses }: Props) {
  const enrolledIds = new Set(profile?.enrolledCourseIds ?? [])

  // Show courses the student is confirmed enrolled in (current or past),
  // plus fall back to date-range matching if no enrollment data is available.
  const relevantCourses = courses.filter(c => {
    const isCurrentCourse = c.name === profile?.currentCourse
    const isEnrolled = enrolledIds.has(c.id)
    const hasRecords = filterRecordsByCourse(records, c).length > 0
    if (enrolledIds.size > 0) {
      return isEnrolled || isCurrentCourse
    }
    // No enrollment data — fall back to date-range heuristic
    return hasRecords || isCurrentCourse
  })

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    () => defaultCourseId(records, relevantCourses, profile?.currentCourse ?? null),
  )

  const selectedCourse = relevantCourses.find(c => c.id === selectedCourseId) ?? null
  const filteredRecords = selectedCourse ? filterRecordsByCourse(records, selectedCourse) : records

  const stats = calcStats(filteredRecords)
  const zone = getZone(stats.absentBlocks)
  const percentMissed = stats.percentMissed

  const zoneBg = {
    green: 'bg-green-100 border-green-400 text-green-900',
    yellow: 'bg-yellow-100 border-yellow-400 text-yellow-900',
    red: 'bg-red-100 border-red-400 text-red-900',
  }[zone]

  const warningBg = { yellow: 'bg-yellow-50 border-yellow-300 text-yellow-800', red: 'bg-red-50 border-red-300 text-red-800' }

  const noData = filteredRecords.length === 0

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

      {noData ? (
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <p className="text-dark-text font-semibold mb-1">No attendance records</p>
          <p className="text-muted-text text-sm">No attendance data found for this course.</p>
        </div>
      ) : (
        <>
          {/* Zone status banner */}
          <div className={`p-4 rounded-xl border-2 flex items-center justify-center ${zoneBg}`}>
            <p className="text-lg font-bold">You are in the {zone.toUpperCase()} zone</p>
          </div>

          {/* Warning banner — yellow/red only */}
          {zone !== 'green' && (
            <div className={`p-4 rounded-xl border-2 flex items-start gap-3 ${warningBg[zone]}`}>
              <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {zone === 'red'
                    ? `Critical: You have missed ${stats.absentBlocks} blocks`
                    : `Warning: You have missed ${stats.absentBlocks} blocks`}
                </p>
                <p className="text-sm mt-1">
                  {zone === 'red'
                    ? 'Please speak with the Student Success Coordinator as soon as possible.'
                    : 'You are approaching the absence limit. Please improve your attendance.'}
                </p>
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="On Time Blocks" value={stats.onTimeBlocks} icon={CheckCircle} colorClass="bg-green-100 text-green-600" />
            <StatCard label="Absent Blocks" value={stats.absentBlocks} icon={XCircle} colorClass="bg-red-100 text-red-600" />
            <StatCard label="Tardy Blocks" value={stats.tardyBlocks} icon={Clock} colorClass="bg-yellow-100 text-yellow-600" />
            {percentMissed !== null && (
              <StatCard
                label="% Missed"
                value={`${Math.round(percentMissed)}%`}
                icon={AlertTriangle}
                colorClass={
                  percentMissed > 7 ? 'bg-red-100 text-red-600'
                  : percentMissed > 4 ? 'bg-yellow-100 text-yellow-600'
                  : 'bg-green-100 text-green-600'
                }
              />
            )}
          </div>
        </>
      )}

      {/* Zone reference table — always visible */}
      <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-dark-text">Attendance Zone Reference</h2>
          <div className="mt-2 space-y-1 text-sm text-muted-text">
            <p>
              <a
                href="https://docs.google.com/document/d/1Tdj0PFWu98j3JDTBsvHHszxOKGazHUvt0faf2Ftogss/edit?tab=t.0#heading=h.1vg41lkd6ugb"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-primary hover:underline"
              >
                Click here to view the full Attendance Policy.
              </a>
            </p>
            <p>You are marked tardy if you arrive between 1 and 19 minutes late.</p>
            <p>You are marked absent if you arrive more than 20 minutes late.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-700">
                <th className="px-6 py-3 font-medium border-b border-gray-200">Zone</th>
                <th className="px-6 py-3 font-medium border-b border-gray-200"># of Absences</th>
                <th className="px-6 py-3 font-medium border-b border-gray-200">What It Means</th>
                <th className="px-6 py-3 font-medium border-b border-gray-200">Next Steps</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-green-50">
                <td className="px-6 py-4 font-semibold text-green-800 border-b border-gray-200">Green Zone (On Track)</td>
                <td className="px-6 py-4 text-gray-800 border-b border-gray-200">≤ 12 blocks (≈3 days, 4% of the course)</td>
                <td className="px-6 py-4 text-gray-800 border-b border-gray-200">You are keeping up with attendance.</td>
                <td className="px-6 py-4 text-gray-800 border-b border-gray-200">No action is needed.</td>
              </tr>
              <tr className="bg-yellow-50">
                <td className="px-6 py-4 font-semibold text-yellow-800 border-b border-gray-200">Yellow Zone (Needs Attention)</td>
                <td className="px-6 py-4 text-gray-800 border-b border-gray-200">13–20 blocks (≈3.5–5 days, 4–7% of course)</td>
                <td className="px-6 py-4 text-gray-800 border-b border-gray-200">Attendance is starting to impact your progress.</td>
                <td className="px-6 py-4 text-gray-800 border-b border-gray-200">Meet with the instructor, TA, and Student Success to make a plan. A PIP may be added if extra support is needed.</td>
              </tr>
              <tr className="bg-red-50">
                <td className="px-6 py-4 font-semibold text-red-800">Red Zone (At Risk)</td>
                <td className="px-6 py-4 text-gray-800">&gt; 20 blocks (≈more than 5 days, 7%+ of course)</td>
                <td className="px-6 py-4 text-gray-800">Attendance is likely to affect your progress and may affect your ability to continue.</td>
                <td className="px-6 py-4 text-gray-800">A PIP will be put in place. Pausing may be necessary, depending on the situation.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
