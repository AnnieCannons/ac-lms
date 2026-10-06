import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/docs/student/getting-started' }))

import DocsLayout from '@/components/docs/DocsLayout'
import SkillConfidence from '@/components/docs/student/SkillConfidence'

const layout = (showSkillConfidence?: boolean) =>
  render(
    <DocsLayout guide="student" section="getting-started" isInstructor={false} backHref="/student/courses" showSkillConfidence={showSkillConfidence}>
      <p>content</p>
    </DocsLayout>
  )

describe('Skill Confidence help docs', () => {
  it('lists the section in the student menu only when the feature is on', () => {
    const { unmount } = layout(true)
    expect(screen.getByRole('link', { name: 'Skill Confidence' })).toHaveAttribute('href', '/docs/student/skill-confidence')
    unmount()
    layout(false)
    expect(screen.queryByRole('link', { name: 'Skill Confidence' })).not.toBeInTheDocument()
  })

  it('hides it by default, so a page that forgets the flag never leaks the entry', () => {
    layout()
    expect(screen.queryByRole('link', { name: 'Skill Confidence' })).not.toBeInTheDocument()
  })

  it('does not hide the other student sections', () => {
    layout(false)
    expect(screen.getByRole('link', { name: 'Assignments' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Flashcard App' })).toBeInTheDocument()
  })

  it('the section explains rating, goals, growing vs maintaining, patterns and who can see it', () => {
    render(<SkillConfidence />)
    expect(screen.getByRole('heading', { level: 1, name: 'Skill Confidence' })).toBeInTheDocument()
    for (const h of [
      /Rating Skills When You Turn In/, /Setting a Goal/, /Skills You Feel Confident On/,
      /My Skill Confidence/, /Patterns/, /Who Can See Your Ratings/,
    ]) {
      expect(screen.getByRole('heading', { name: h })).toBeInTheDocument()
    }
    expect(screen.getByText(/Skills you.re growing/)).toBeInTheDocument()
    expect(screen.getByText(/Skills you.re maintaining/)).toBeInTheDocument()
  })

  it('says plainly that ratings and goals are not part of grades', () => {
    render(<SkillConfidence />)
    expect(screen.getByText(/not part of your grades/)).toBeInTheDocument()
    expect(screen.getByText(/Your grades are not affected/)).toBeInTheDocument()
  })

  it('explains that it helps students see how their studying relates to their confidence', () => {
    render(<SkillConfidence />)
    expect(screen.getByText(/how your studying shows up in your confidence/)).toBeInTheDocument()
  })

  it('explains that answering what helped builds the Patterns tab', () => {
    render(<SkillConfidence />)
    expect(screen.getByText(/Each answer you share helps build the patterns/)).toBeInTheDocument()
  })

  it('explains the reminder is a way back to a skipped question', () => {
    render(<SkillConfidence />)
    expect(screen.getByText(/a reminder stays in your notification bell/)).toBeInTheDocument()
    expect(screen.getByText(/Answering the question removes the reminder/)).toBeInTheDocument()
  })

  it('says instructors can see individual students as well as class-wide counts', () => {
    render(<SkillConfidence />)
    expect(screen.getByText(/one student at a time, and also at how the whole class is doing/)).toBeInTheDocument()
  })

  it('has numbered how-to-rate steps in order', () => {
    const { container } = render(<SkillConfidence />)
    const h = screen.getByRole('heading', { name: 'How to rate a skill' })
    expect(h).toBeInTheDocument()
    // Only look after the heading: some phrases also appear earlier in the section.
    const all = container.textContent ?? ''
    const text = all.slice(all.indexOf('How to rate a skill'))
    const order = ['Open an assignment that has tagged skills', 'above the Submit button', 'pick a number from 1 to 10', 'set a goal for a skill you rated below 10', 'choose a target date and a study plan', 'Your ratings are saved when you turn in']
    const positions = order.map(o => text.indexOf(o))
    expect(positions.every(p => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('says class-wide results never name students, and explains the Submit button', () => {
    render(<SkillConfidence />)
    expect(screen.getByText(/They never name students or show the text you write in yourself/)).toBeInTheDocument()
    expect(screen.getByText(/Submit stays off until all three parts are filled in/)).toBeInTheDocument()
  })

  it('uses no mastered or reactivate wording, which was removed from the feature', () => {
    const { container } = render(<SkillConfidence />)
    expect(container.textContent).not.toMatch(/mastered|reactivat/i)
  })
})
