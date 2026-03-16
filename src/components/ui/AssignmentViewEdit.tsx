'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import HtmlContent from './HtmlContent'
import AssignmentEditor from './AssignmentEditor'

interface ChecklistItem {
  id: string
  text: string
  description: string | null
  order: number
  required: boolean
}

interface Override {
  id: string
  student_id: string
  student_name: string
  due_date: string | null
  excused: boolean
}

interface Assignment {
  id: string
  title: string
  description: string | null
  how_to_turn_in: string | null
  due_date: string | null
  published: boolean
  answer_key_url: string | null
  submission_required: boolean
  skill_tags: string[] | null
  is_bonus: boolean
}

interface Props {
  courseId: string
  assignment: Assignment
  initialChecklist: ChecklistItem[]
  enrolledStudents: { id: string; name: string }[]
  initialOverrides: Override[]
}

const HTML_CLASSES = `text-sm text-dark-text leading-relaxed
  [&_h2]:font-bold [&_h2]:text-base [&_h2]:mt-4 [&_h2]:mb-2
  [&_h3]:font-semibold [&_h3]:text-sm [&_h3]:mt-3 [&_h3]:mb-1
  [&_p]:mb-2 [&_p:last-child]:mb-0
  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2
  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2
  [&_li]:mb-0.5
  [&_a]:text-teal-primary [&_a]:underline
  [&_strong]:font-semibold`

export default function AssignmentViewEdit({ courseId, assignment: initialAssignment, initialChecklist, enrolledStudents, initialOverrides }: Props) {
  const searchParams = useSearchParams()
  const [editing, setEditing] = useState(searchParams.get('edit') === '1')
  const [assignment, setAssignment] = useState(initialAssignment)
  const [checklist, setChecklist] = useState(initialChecklist)

  if (editing) {
    return (
      <AssignmentEditor
        courseId={courseId}
        assignment={assignment}
        initialChecklist={checklist}
        enrolledStudents={enrolledStudents}
        initialOverrides={initialOverrides}
        onSaved={(updated, updatedChecklist) => {
          if (updated) setAssignment(prev => ({ ...prev, ...updated }))
          if (updatedChecklist) setChecklist(updatedChecklist)
          setEditing(false)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-dark-text">{assignment.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${assignment.published ? 'border-teal-primary text-teal-primary' : 'border-border text-muted-text'}`}>
              {assignment.published ? '● Published' : '○ Draft'}
            </span>
            {assignment.submission_required && (
              <span className="badge-amber text-xs font-medium px-2.5 py-1 rounded-full border">Submission required</span>
            )}
            {assignment.is_bonus && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full border border-purple-primary/40 text-purple-primary bg-purple-light">★ Bonus</span>
            )}
            {assignment.due_date && (
              <span className="text-xs text-muted-text">
                Due {new Date(assignment.due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/instructor/courses/${courseId}/assignments/${assignment.id}/submissions`}
            className="text-sm text-muted-text hover:text-teal-primary transition-colors"
          >
            View Submissions →
          </Link>
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-semibold px-4 py-1.5 rounded-full border border-teal-primary text-teal-primary hover:bg-teal-primary hover:text-white transition-colors"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Skill tags */}
      {assignment.skill_tags && assignment.skill_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {assignment.skill_tags.map(tag => (
            <span key={tag} className="text-xs px-2.5 py-1 rounded-full border border-teal-primary bg-teal-primary text-white">{tag}</span>
          ))}
        </div>
      )}

      {/* Instructions */}
      {assignment.description && (
        <div className="bg-surface rounded-2xl border border-border p-6">
          <p className="text-xs font-bold text-muted-text uppercase tracking-wide mb-3">Instructions</p>
          <HtmlContent html={assignment.description} className={HTML_CLASSES} />
        </div>
      )}

      {/* How to turn in */}
      {assignment.how_to_turn_in && (
        <div className="bg-surface rounded-2xl border border-border p-6">
          <p className="text-xs font-bold text-muted-text uppercase tracking-wide mb-3">How to Turn In</p>
          <HtmlContent html={assignment.how_to_turn_in} className={HTML_CLASSES} />
        </div>
      )}

      {/* Answer key */}
      {assignment.answer_key_url && (
        <div className="flex items-center gap-3 px-4 py-3 badge-amber border rounded-xl">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
          <a href={assignment.answer_key_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:underline flex items-center gap-1.5">
            Answer Key
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>
      )}

      {/* Checklist */}
      {checklist.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border p-6">
          <p className="text-xs font-bold text-muted-text uppercase tracking-wide mb-4">Grading Checklist</p>
          <div className="flex flex-col gap-3">
            {[...checklist].sort((a, b) => a.order - b.order).map(item => (
              <div key={item.id}>
                <div className="flex items-center gap-2">
                  <span className="text-muted-text shrink-0 text-sm">☐</span>
                  <p className="text-sm font-medium text-dark-text">{item.text}</p>
                  {!item.required && (
                    <span className="badge-amber text-xs font-medium px-1.5 py-0.5 rounded-full border">Bonus</span>
                  )}
                </div>
                {item.description && <p className="pl-5 text-xs text-muted-text mt-0.5">{item.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
