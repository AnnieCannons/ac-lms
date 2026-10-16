import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/react'
import type { LevelUpLink } from '@/lib/level-up-links'

const actions = vi.hoisted(() => ({
  createLevelUpLink: vi.fn(),
  updateLevelUpLink: vi.fn(),
  deleteLevelUpLink: vi.fn(),
  moveLevelUpLink: vi.fn(),
  listLevelUpLinksForEditor: vi.fn(),
}))
vi.mock('@/lib/level-up-actions', () => actions)

import LevelUpLinksEditor from '@/components/ui/LevelUpLinksEditor'

const link = (over: Partial<LevelUpLink>): LevelUpLink => ({
  id: Math.random().toString(36), course_id: null, platform: 'codecademy', title: 'Course', url: 'https://example.com',
  description: null, order: 0, published: true, ...over,
})

// jsdom has <dialog> but not showModal/close
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.open = false })
})

beforeEach(() => {
  vi.clearAllMocks()
  actions.listLevelUpLinksForEditor.mockResolvedValue({ links: [], canEditShared: true })
})

describe('LevelUpLinksEditor', () => {
  it('shows the same study tools and platform cards students see, with links editable from the card pop-up', async () => {
    const user = userEvent.setup()
    render(<LevelUpLinksEditor courseId="c1" canEditShared initialLinks={[
      link({ title: 'Learn HTML', course_id: 'c1', description: 'Keep practicing' }),
      link({ title: 'Old one', published: false }),
    ]} />)
    expect(screen.getByRole('link', { name: /flashcards/i })).toHaveAttribute('href', '/flashcards?from=%2Finstructor%2Fcourses%2Fc1%2Flevel-up')
    expect(screen.getByRole('link', { name: /practice quizzes/i })).toHaveAttribute('href', '/instructor/courses/c1/quizzes')
    expect(screen.getByRole('link', { name: /open udemy/i })).toBeInTheDocument()
    // Every card shows, even an empty "other", so links can be added to it
    expect(screen.getByRole('region', { name: 'More recommended courses' })).toBeInTheDocument()

    const cc = screen.getByRole('region', { name: 'Codecademy' })
    // Same button students get, hidden one counted separately; opens the editor in a pop-up
    await user.click(within(cc).getByRole('button', { name: '1 recommended course (+1 hidden) · Edit' }))
    expect(within(cc).getByRole('link', { name: /learn html/i }).closest('dialog')).not.toBeNull()
    expect(within(cc).getByRole('link', { name: /learn html/i })).toBeInTheDocument()
    expect(within(cc).getByText('This course')).toBeInTheDocument()
    expect(within(cc).getByText('Every course')).toBeInTheDocument()
    expect(within(cc).getByText('Hidden from students')).toBeInTheDocument()
  })

  it('adds a course to the card it was added from, this course only by default', async () => {
    actions.createLevelUpLink.mockResolvedValue({ link: link({}) })
    const user = userEvent.setup()
    render(<LevelUpLinksEditor courseId="c1" canEditShared initialLinks={[]} />)
    const fcc = screen.getByRole('region', { name: 'freeCodeCamp' })
    await user.click(within(fcc).getByRole('button', { name: '+ Add recommended courses' }))
    await user.click(within(fcc).getByRole('button', { name: '+ Add a course' }))
    await user.type(within(fcc).getByLabelText('Title'), 'JS Algorithms')
    await user.type(within(fcc).getByLabelText('Link'), 'https://www.freecodecamp.org/learn')
    await user.click(within(fcc).getByRole('button', { name: 'Add course' }))
    expect(actions.createLevelUpLink).toHaveBeenCalledWith(expect.objectContaining({ courseId: 'c1', platform: 'freecodecamp', shared: false, title: 'JS Algorithms' }))
  })

  it("doesn't let a TA change shared links or add to every course", async () => {
    const user = userEvent.setup()
    render(<LevelUpLinksEditor courseId="c1" canEditShared={false} initialLinks={[
      link({ title: 'Shared one' }),
      link({ title: 'Mine', course_id: 'c1' }),
    ]} />)
    const cc = screen.getByRole('region', { name: 'Codecademy' })
    await user.click(within(cc).getByRole('button', { name: /recommended courses · edit/i }))
    expect(within(cc).getAllByRole('button', { name: 'Edit' })).toHaveLength(1)
    await user.click(within(cc).getByRole('button', { name: '+ Add a course' }))
    expect(within(cc).queryByLabelText('Every course')).not.toBeInTheDocument()
  })
})
