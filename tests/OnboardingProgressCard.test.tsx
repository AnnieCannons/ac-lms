import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OnboardingProgressCard from '@/components/onboarding/OnboardingProgressCard'

const base = { courseId: 'c1', done: 4, total: 4, finished: true, waitingOnStaff: 0, needsRevision: 0, equipmentToShip: 'laptop' }
const receiving = [{ id: 'a9', title: 'Receiving Your Laptop' }]
const heading = () => screen.getByRole('heading', { level: 2 }).textContent

describe('OnboardingProgressCard', () => {
  it('before the laptop ships: congratulates and sends them back for the last task once it arrives', () => {
    render(<OnboardingProgressCard {...base} shipping="to_ship" lastTasks={receiving} />)
    expect(heading()).toContain("Congratulations! We're getting your laptop ready to ship.")
    expect(screen.getByText(/When it arrives, come back here to finish your last task/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Receiving Your Laptop/ })).toHaveAttribute('href', '/student/courses/c1/assignments/a9')
    expect(screen.queryByText(/you finished Enrollment Readiness!/)).toBeNull()
    expect(screen.getByRole('link', { name: /Learn HTML on Codecademy/ })).toBeInTheDocument()
  })

  it('while it’s on the way: asks them to click I got it first', () => {
    render(<OnboardingProgressCard {...base} shipping="on_the_way" lastTasks={receiving} />)
    expect(heading()).toContain('Your laptop is on the way.')
    expect(screen.getByText(/then come back here to finish your last task/)).toBeInTheDocument()
  })

  it('once it arrived: just the last task', () => {
    render(<OnboardingProgressCard {...base} shipping="arrived" lastTasks={receiving} />)
    expect(heading()).toContain("you're almost done!")
    expect(screen.getByText(/Your laptop arrived. Finish your last task/)).toBeInTheDocument()
  })

  it('with nothing left: the full congratulations', () => {
    render(<OnboardingProgressCard {...base} shipping="arrived" lastTasks={[]} />)
    expect(heading()).toContain('Congratulations, you finished Enrollment Readiness!')
  })

  it('before finishing: the progress bar', () => {
    render(<OnboardingProgressCard {...base} done={2} finished={false} shipping="to_ship" lastTasks={receiving} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(screen.getByText('2 of 4 complete')).toBeInTheDocument()
  })
})
