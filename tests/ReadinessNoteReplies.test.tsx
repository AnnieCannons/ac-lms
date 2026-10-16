import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('recharts', () => ({}))
vi.mock('@/lib/readiness-notes-actions', () => ({
  addReadinessNoteReply: vi.fn(async () => ({})),
  updateReadinessNoteReply: vi.fn(async () => ({})),
  deleteReadinessNoteReply: vi.fn(async () => ({})),
}))

import NoteReplyThread from '@/components/ui/ReadinessNoteReplies'
import { addReadinessNoteReply } from '@/lib/readiness-notes-actions'
import type { ReadinessNote, ReadinessNoteReply } from '@/lib/readiness-notes-actions'

const reply = (over: Partial<ReadinessNoteReply>): ReadinessNoteReply => ({
  id: 'r1', body: 'Thanks!', authorName: 'Titeanya', fromStudent: true, mine: false,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), canEdit: false, canDelete: false, ...over,
})

const note = (over: Partial<ReadinessNote> = {}): ReadinessNote => ({
  id: 'n1', noteDate: '2026-10-16', body: 'hi', visibleToStudent: true, authorName: 'Catie',
  createdAt: '', updatedAt: '', canEdit: false, canDelete: false, replies: [], canReply: true, ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('NoteReplyThread', () => {
  it('lets the student post a reply and refreshes the notes', async () => {
    const onChanged = vi.fn()
    const user = userEvent.setup()
    render(<NoteReplyThread note={note()} audience="student" onChanged={onChanged} />)
    await user.click(screen.getByRole('button', { name: 'Reply' }))
    await user.type(screen.getByPlaceholderText(/reply to your instructor/i), 'I’ll come next Friday.')
    await user.click(screen.getByRole('button', { name: 'Reply' }))
    expect(addReadinessNoteReply).toHaveBeenCalledWith({ noteId: 'n1', body: 'I’ll come next Friday.' })
    expect(onChanged).toHaveBeenCalled()
  })

  it('shows the student their own replies as "You", with edit and delete', () => {
    render(<NoteReplyThread note={note({ replies: [reply({ mine: true, canEdit: true, canDelete: true })] })} audience="student" onChanged={() => {}} />)
    const list = screen.getByRole('list', { name: 'Replies' })
    expect(within(list).getByText('You')).toBeTruthy()
    expect(within(list).getByRole('button', { name: 'Edit' })).toBeTruthy()
    expect(within(list).getByRole('button', { name: 'Delete' })).toBeTruthy()
    expect(within(list).queryByText('Student')).toBeNull()
  })

  it('tags the student’s replies for staff', () => {
    render(<NoteReplyThread note={note({ replies: [reply({})] })} audience="staff" onChanged={() => {}} />)
    expect(screen.getByText('Titeanya')).toBeTruthy()
    expect(screen.getByText('Student')).toBeTruthy()
  })

  it('keeps an unshared note’s thread read-only for staff', () => {
    render(<NoteReplyThread note={note({ canReply: false, visibleToStudent: false, replies: [reply({})] })} audience="staff" onChanged={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull()
    expect(screen.getByText(/replies are closed/i)).toBeTruthy()
  })

  it('renders nothing for a staff-only note with no replies', () => {
    const { container } = render(<NoteReplyThread note={note({ canReply: false, visibleToStudent: false })} audience="staff" onChanged={() => {}} />)
    expect(container.innerHTML).toBe('')
  })
})
