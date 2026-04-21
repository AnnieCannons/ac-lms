'use client'
import { localDate, todayLocal } from '@/lib/date-utils'

interface Submission {
  status: string
  grade: string | null
}

interface Props {
  courseId: string
  assignmentId: string
  studentId: string
  submission: Submission | null
  dueDate: string | null
}

export default function GradebookCell({ courseId, assignmentId, studentId, submission, dueDate }: Props) {
  const isPastDue = dueDate ? localDate(dueDate) < todayLocal() : false

  const hasSubmission = !!submission && submission.status !== 'draft'

  let icon = ''
  let cellClass = ''
  let cellLabel = 'Not submitted'

  if (hasSubmission) {
    if (submission!.status === 'graded' && submission!.grade === 'complete') {
      icon = '✓'
      cellClass = 'status-complete-btn'
      cellLabel = 'Complete'
    } else if (submission!.status === 'graded' && submission!.grade === 'incomplete') {
      icon = '✗'
      cellClass = 'status-revision-btn'
      cellLabel = 'Needs Revision'
    } else if (submission!.status === 'submitted') {
      icon = '●'
      cellClass = 'status-needs-grading-btn'
      cellLabel = 'Submitted – needs grading'
    }
  } else if (isPastDue) {
    icon = '–'
    cellClass = 'status-late-badge'
    cellLabel = 'Missing / past due'
  }

  const graderUrl = hasSubmission
    ? `/instructor/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}?by=student`
    : null

  return (
    <td className={`relative group p-0 border-r border-b border-border overflow-hidden ${cellClass}`} title={cellLabel} aria-label={cellLabel}>
      <div className="w-full h-full min-h-[44px] flex items-center justify-center text-sm font-bold">
        <span aria-hidden="true">{icon}</span>
      </div>
      {graderUrl && (
        <a
          href={graderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-black/10 dark:bg-white/10 text-[9px] font-bold text-dark-text transition-opacity"
        >
          Open
        </a>
      )}
    </td>
  )
}
