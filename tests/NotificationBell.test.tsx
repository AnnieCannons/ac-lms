import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/notification-actions', () => ({
  getMyNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  clearNotification: vi.fn(),
}))

import NotificationBell from '@/components/ui/NotificationBell'
import { getMyNotifications, markNotificationRead, clearNotification } from '@/lib/notification-actions'

const base = { course_id: null, assignment_id: null, extension_request_id: null, deck_id: null, read: false, created_at: new Date().toISOString() }
const REMINDER = { ...base, id: 'n1', type: 'confidence_goal_what_helped', message: 'You reached your goal of 9 in React. Log what helped.' }
const OTHER = { ...base, id: 'n2', type: 'grade_posted', message: 'Your "Quiz" submission was marked complete.' }

async function openBell(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^Notifications/ }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getMyNotifications).mockResolvedValue([REMINDER, OTHER])
})

describe('NotificationBell', () => {
  it('offers a Clear button on each notification', async () => {
    const user = userEvent.setup()
    render(<NotificationBell />)
    await openBell(user)
    expect(screen.getAllByRole('button', { name: /^Clear notification/ })).toHaveLength(2)
  })

  it('Clear removes only that notification and the unread count drops, without opening it', async () => {
    const user = userEvent.setup()
    render(<NotificationBell />)
    expect(await screen.findByRole('button', { name: 'Notifications, 2 unread' })).toBeInTheDocument()
    await openBell(user)
    await user.click(screen.getByRole('button', { name: `Clear notification: ${REMINDER.message}` }))

    expect(clearNotification).toHaveBeenCalledWith('n1')
    expect(screen.queryByText(REMINDER.message)).not.toBeInTheDocument()
    expect(screen.getByText(OTHER.message)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
    expect(markNotificationRead).not.toHaveBeenCalled()
  })

  it('opens the "what helped" section when the reminder is clicked, and clears it from the bell', async () => {
    const user = userEvent.setup()
    render(<NotificationBell />)
    await openBell(user)
    await user.click(screen.getByText(REMINDER.message))
    expect(push).toHaveBeenCalledWith('/student/skill-confidence#what-helped')
    expect(clearNotification).toHaveBeenCalledWith('n1')
    await openBell(user)
    expect(screen.queryByText(REMINDER.message)).not.toBeInTheDocument()
  })

  it('only marks other notifications read when they are clicked; they stay in the bell', async () => {
    const user = userEvent.setup()
    render(<NotificationBell />)
    await openBell(user)
    await user.click(screen.getByText(OTHER.message))
    expect(markNotificationRead).toHaveBeenCalledWith('n2')
    expect(clearNotification).not.toHaveBeenCalled()
  })

  it('keeps a read reminder in the bell until it is cleared or answered', async () => {
    vi.mocked(getMyNotifications).mockResolvedValue([{ ...REMINDER, read: true }])
    const user = userEvent.setup()
    render(<NotificationBell />)
    await openBell(user)
    const item = screen.getByText(REMINDER.message).closest('li')!
    expect(within(item).getByRole('button', { name: /^Clear notification/ })).toBeInTheDocument()
  })
})
