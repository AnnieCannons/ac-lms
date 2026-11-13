import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/student/courses/c1/class-resources',
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/lib/resource-actions', () => ({
  toggleResourceStar: vi.fn(async () => ({})),
  toggleResourceComplete: vi.fn(async () => ({})),
}))
vi.mock('@/lib/trash-actions', () => ({ trashResource: vi.fn() }))

import ResourceOutline from '@/components/ui/ResourceOutline'
import { toggleResourceStar } from '@/lib/resource-actions'

const res = (id: string, title: string, order: number) => ({ id, type: 'link', title, content: 'https://example.com', description: null, order })
const modules = [
  { id: 'm1', title: 'Week 1', week_number: 1, order: 1, module_days: [
    { id: 'd1', day_name: 'Monday', order: 1, resources: [res('r1', 'HTML Reference', 1), res('r2', 'Notion notes', 2)] },
  ] },
  { id: 'm2', title: 'Week 2', week_number: 2, order: 2, module_days: [
    { id: 'd2', day_name: 'Monday', order: 1, resources: [res('r3', 'CSS Tricks', 1)] },
  ] },
]

const renderOutline = (starred: string[], readOnly = false) =>
  render(<ResourceOutline modules={modules} courseId="c1" mode="resources" initialStarredIds={starred} initialCompletedIds={[]} readOnly={readOnly} />)

describe('ResourceOutline — Starred filter', () => {
  it('shows only starred resources, with a count, and hides weeks that have none', async () => {
    renderOutline(['r1'])
    const user = userEvent.setup()
    const toggle = screen.getByRole('button', { name: /show only starred resources \(1\)/i })

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('HTML Reference')).toBeInTheDocument()
    expect(screen.queryByText('Notion notes')).not.toBeInTheDocument()
    expect(screen.queryByText('CSS Tricks')).not.toBeInTheDocument()
    expect(screen.queryByText('Week 2')).not.toBeInTheDocument()

    // Turning it off brings everything back (turning it on expanded every day)
    await user.click(toggle)
    expect(screen.getByText('Notion notes')).toBeInTheDocument()
    expect(screen.getByText('CSS Tricks')).toBeInTheDocument()
  })

  it('combines with search', async () => {
    renderOutline(['r1', 'r3'])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /show only starred/i }))
    await user.type(screen.getByPlaceholderText('Search resources…'), 'css')
    expect(screen.getByText('CSS Tricks')).toBeInTheDocument()
    expect(screen.queryByText('HTML Reference')).not.toBeInTheDocument()
  })

  it('explains the empty state when nothing is starred', async () => {
    renderOutline([])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /show only starred resources \(0\)/i }))
    expect(screen.getByText(/No starred resources yet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show all resources' }))
    expect(screen.getByText('HTML Reference')).toBeInTheDocument()
  })

  it('read-only (viewing as a student) can filter but never toggles a star', async () => {
    renderOutline(['r1'], true)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /show only starred/i }))
    expect(screen.getByText('HTML Reference')).toBeInTheDocument()
    const starButtons = screen.queryAllByRole('button', { name: /star/i }).filter(b => !/show only starred/i.test(b.getAttribute('aria-label') ?? ''))
    expect(starButtons.length).toBeGreaterThan(0)
    for (const b of starButtons) await user.click(b)
    expect(toggleResourceStar).not.toHaveBeenCalled()
  })
})
