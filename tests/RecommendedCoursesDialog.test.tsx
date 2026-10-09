import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecommendedCoursesDialog from '@/components/ui/RecommendedCoursesDialog'
import type { LevelUpLink } from '@/lib/level-up-links'

// jsdom has <dialog> but not showModal/close; stand them in by toggling `open`
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true })
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.open = false })
})

const links: LevelUpLink[] = [
  { id: 'a', course_id: 'c1', platform: 'codecademy', title: 'Learn HTML', url: 'https://www.codecademy.com/learn/learn-html', description: 'Start here', order: 0, published: true },
  { id: 'b', course_id: 'c1', platform: 'codecademy', title: 'Learn CSS', url: 'https://www.codecademy.com/learn/learn-css', description: null, order: 1, published: true },
]

describe('RecommendedCoursesDialog', () => {
  it('opens a labelled dialog listing the courses, and closes with ✕', async () => {
    const user = userEvent.setup()
    render(<RecommendedCoursesDialog platformName="Codecademy" links={links} />)
    const dialog = document.querySelector('dialog')!
    expect(dialog.open).toBe(false)

    await user.click(screen.getByRole('button', { name: '2 recommended courses' }))
    expect(dialog.open).toBe(true)
    expect(dialog).toHaveAccessibleName('Recommended on Codecademy')
    expect(screen.getByRole('link', { name: /learn html/i })).toHaveAttribute('href', 'https://www.codecademy.com/learn/learn-html')
    expect(screen.getByText('Start here')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(dialog.open).toBe(false)
  })

  it('closes when a course is opened, so it is not still up when they come back', async () => {
    const user = userEvent.setup()
    render(<RecommendedCoursesDialog platformName="Codecademy" links={links} />)
    await user.click(screen.getByRole('button', { name: '2 recommended courses' }))
    const course = screen.getByRole('link', { name: /learn css/i })
    expect(course).toHaveAttribute('target', '_blank')
    course.addEventListener('click', e => e.preventDefault()) // don't navigate jsdom
    await user.click(course)
    expect(document.querySelector('dialog')!.open).toBe(false)
  })

  it('closes on a backdrop click but not on a click inside', async () => {
    const user = userEvent.setup()
    render(<RecommendedCoursesDialog platformName="Codecademy" links={links} />)
    await user.click(screen.getByRole('button', { name: '2 recommended courses' }))
    const dialog = document.querySelector('dialog')!
    await user.click(screen.getByText('Start here'))
    expect(dialog.open).toBe(true)
    await user.click(dialog)
    expect(dialog.open).toBe(false)
  })
})
