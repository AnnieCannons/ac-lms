import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/grade-actions', () => ({
  addSubmissionComment: vi.fn(), editSubmissionComment: vi.fn(), deleteSubmissionComment: vi.fn(),
}))
vi.mock('@/components/ui/RichTextEditor', () => ({ default: () => <div data-testid="editor" /> }))
vi.mock('@/components/ui/EmojiPickerButton', () => ({ default: () => null }))

import SubmissionComments, { type CommentEntry } from '@/components/ui/SubmissionComments'

const comments: CommentEntry[] = [
  { id: 'c1', content: 'my question', created_at: '2026-10-09T15:00:00Z', author_id: 'student1', author_name: 'Lulu', author_role: 'student' },
  { id: 'c2', content: 'instructor reply', created_at: '2026-10-09T16:00:00Z', author_id: 'inst1', author_name: 'Catie', author_role: 'instructor' },
]

// As SubmissionForm passes it while an admin views as a student: the student's id, the admin's role
const renderAs = (readOnly: boolean) => render(
  <SubmissionComments submissionId="sub1" initialComments={comments} currentUserId="student1"
    currentUserName="Admin" currentUserRole="admin" readOnly={readOnly} />
)

describe('SubmissionComments readOnly', () => {
  it('shows the comments but no comment box and no edit or delete', () => {
    renderAs(true)
    expect(screen.getByText('my question')).toBeInTheDocument()
    expect(screen.getByText('instructor reply')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('without readOnly the same props would offer edit and delete (what readOnly prevents)', () => {
    renderAs(false)
    expect(screen.getAllByRole('button', { name: /delete/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })
})
