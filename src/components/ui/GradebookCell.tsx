'use client'

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
  const now = new Date()
  const isPastDue = dueDate ? new Date(dueDate) < now : false

  const hasSubmission = !!submission && submission.status !== 'draft'

  let icon = ''
  let cellClass = ''

  if (hasSubmission) {
    if (submission!.status === 'graded' && submission!.grade === 'complete') {
      icon = '✓'
      cellClass = 'status-complete-btn'
    } else if (submission!.status === 'graded' && submission!.grade === 'incomplete') {
      icon = '✗'
      cellClass = 'status-revision-btn'
    } else if (submission!.status === 'submitted') {
      icon = '●'
      cellClass = 'status-needs-grading-btn'
    }
  } else if (isPastDue) {
    icon = '–'
    cellClass = 'status-late-badge'
  }

  const graderUrl = hasSubmission
    ? `/instructor/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}?by=student`
    : null

  return (
    <td className="relative group p-0 border-r border-b border-border overflow-hidden">
      <div className={`w-full h-11 flex items-center justify-center text-sm font-bold border border-border/30 ${cellClass}`}>
        {icon}
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
