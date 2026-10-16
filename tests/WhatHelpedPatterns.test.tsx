import { afterEach, describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WhatHelpedPatterns from '@/components/ui/WhatHelpedPatterns'
import type { SkillTrend, TrendGoal, TrendGoalMet } from '@/lib/confidence-trend'

const goal = (id: string, values: string[]): TrendGoal => ({
  id, goal: 7, isMaintain: false, targetDate: null, studyPlanLabels: [], ownPlanText: null, setAt: '2026-02-01T10:00:00Z',
  met: { outcomeId: `o-${id}`, metAt: '2026-03-02T10:00:00Z', rating: 7, answered: true, answerLabels: [], answerValues: values },
})

const trend = (skillId: string, name: string, previousGoals: TrendGoal[]): SkillTrend => ({
  skillId, name, ratings: [], startCourseName: null, courseBreakpoints: [], currentGoal: null, previousGoals, reachedTens: [], isMaintaining: false,
  latestRating: 7, goalStatus: 'met', canSetGoal: false,
})

// Each method's skills are a list labelled "Skills <method> helped on". Look only inside those: a hidden
// copy of the row (used to measure widths) repeats the names.
const skillLists = () => screen.getAllByRole('list', { name: /helped on/ })
// A skill's tag in one list, e.g. chip(list, 'React') has text "React: 3" (the colon is screen-reader only).
const chip = (list: HTMLElement, name: string) => within(list).getByText(name).closest('li')!

describe('WhatHelpedPatterns', () => {
  it('counts a return-to-10 answer like a goal answer', () => {
    const ten: TrendGoalMet = { outcomeId: 'ot', metAt: '2026-04-01T10:00:00Z', rating: 10, answered: true, answerLabels: [], answerValues: ['flashcards'] }
    render(<WhatHelpedPatterns trends={[{ ...trend('s1', 'React', []), reachedTens: [ten], isMaintaining: true, latestRating: 10 }]} />)
    expect(screen.getByText('Studying flashcards')).toBeInTheDocument()
    expect(screen.getByText('Helped 1 time')).toBeInTheDocument()
    expect(chip(skillLists()[0], 'React')).toHaveTextContent('React: 1')
  })

  it('shows only a gentle note, plus the reading guide, with no answers', () => {
    render(<WhatHelpedPatterns trends={[]} />)
    expect(screen.getByRole('heading', { name: 'What tends to help you' })).toBeInTheDocument()
    expect(screen.getByText(/Patterns will show up here as you reach goals/)).toBeInTheDocument()
    expect(screen.getByText(/not proof that a method caused it/)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows a single answer as "helped 1 time" with its skill', () => {
    render(<WhatHelpedPatterns trends={[trend('s1', 'React', [goal('g1', ['flashcards'])])]} />)
    expect(screen.getByText('Studying flashcards')).toBeInTheDocument()
    expect(screen.getByText('Helped 1 time')).toBeInTheDocument()
    expect(chip(skillLists()[0], 'React')).toHaveTextContent('React: 1')
    expect(screen.getByText(/The following is based on 1 time where/)).toBeInTheDocument()
    expect(screen.queryByText(/Patterns will show up here/)).not.toBeInTheDocument()
  })

  it('shows counts and per-skill counts as text, and notes that methods overlap', () => {
    const trends = [
      trend('s1', 'React', [goal('g1', ['flashcards', 'ta_help']), goal('g2', ['flashcards'])]),
      trend('s2', 'CSS', [goal('g3', ['flashcards'])]),
    ]
    render(<WhatHelpedPatterns trends={trends} />)
    expect(screen.getByText('Helped 3 times')).toBeInTheDocument()
    // React helped under two methods (flashcards first, by count), so it appears under each.
    const [flashcards, ta] = skillLists()
    expect(chip(flashcards, 'React')).toHaveTextContent('React: 2')
    expect(chip(ta, 'React')).toHaveTextContent('React: 1')
    expect(chip(flashcards, 'CSS')).toHaveTextContent('CSS: 1')
    expect(screen.getByText(/The following is based on 3 times where/)).toBeInTheDocument()
    expect(screen.getByText(/won't add up to your total/)).toBeInTheDocument()
  })

  it('shows the top 3 skills inline and folds the rest, closed until opened', async () => {
    const user = userEvent.setup()
    const trends = [
      trend('s1', 'React', [goal('g1', ['flashcards']), goal('g2', ['flashcards']), goal('g3', ['flashcards'])]),
      trend('s2', 'CSS', [goal('g4', ['flashcards']), goal('g5', ['flashcards'])]),
      trend('s3', 'Git', [goal('g6', ['flashcards'])]),
      trend('s4', 'Figma', [goal('g7', ['flashcards'])]),
      trend('s5', 'SQL', [goal('g8', ['flashcards'])]),
    ]
    render(<WhatHelpedPatterns trends={trends} />)
    const [list] = skillLists()
    for (const name of ['React', 'CSS', 'Figma']) expect(within(list).getByText(name)).toBeInTheDocument()
    expect(within(list).queryByText('Git')).not.toBeInTheDocument()
    expect(within(list).queryByText('SQL')).not.toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: '+2 more' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveTextContent('Show fewer')
    expect(chip(list, 'Git')).toHaveTextContent('Git: 1')
    expect(chip(list, 'SQL')).toHaveTextContent('SQL: 1')
    await user.click(toggle)
    expect(within(list).queryByText('Git')).not.toBeInTheDocument()
    expect(toggle).toHaveTextContent('+2 more')
  })

  describe('with a real layout', () => {
    const originals = {
      client: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
      offset: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'),
    }
    afterEach(() => {
      if (originals.client) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originals.client)
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth
      if (originals.offset) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originals.offset)
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetWidth
    })

    const eight = () => Array.from({ length: 8 }, (_, i) => trend(`s${i}`, `Skill ${i}`, [goal(`g${i}`, ['flashcards'])]))

    // Every tag (and the "+N more" pill) is 100px wide with 6px gaps, in a row of the given width.
    const layout = (rowWidth: number) => {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => rowWidth })
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 100 })
    }

    it('shows as many skills as fit on one line, with "+N more" as the last item', () => {
      layout(650) // 5 tags + gap + pill = 5*100 + 5*6 + 100 = 630 fits; 6 would need 736
      render(<WhatHelpedPatterns trends={eight()} />)
      const [list] = skillLists()
      const items = within(list).getAllByRole('listitem')
      expect(items).toHaveLength(6)
      expect(items.slice(0, 5).map(li => li.textContent)).toEqual(['Skill 0: 1', 'Skill 1: 1', 'Skill 2: 1', 'Skill 3: 1', 'Skill 4: 1'])
      expect(items[5]).toHaveTextContent('+3 more')
    })

    it('shows every skill and no "+N more" when they all fit', () => {
      layout(2000)
      render(<WhatHelpedPatterns trends={eight()} />)
      expect(within(skillLists()[0]).getAllByRole('listitem')).toHaveLength(8)
      expect(screen.queryByRole('button', { name: /more/ })).not.toBeInTheDocument()
    })

    it('always shows at least one skill, even on a very narrow row', () => {
      layout(120)
      render(<WhatHelpedPatterns trends={eight()} />)
      expect(within(skillLists()[0]).getAllByRole('listitem')).toHaveLength(2)
      expect(screen.getByRole('button', { name: '+7 more' })).toBeInTheDocument()
    })
  })

  it('has nothing to fold for three skills or fewer', () => {
    const trends = [trend('s1', 'React', [goal('g1', ['flashcards'])]), trend('s2', 'CSS', [goal('g2', ['flashcards'])]), trend('s3', 'Git', [goal('g3', ['flashcards'])])]
    render(<WhatHelpedPatterns trends={trends} />)
    expect(screen.queryByRole('button', { name: /more/ })).not.toBeInTheDocument()
  })

  it('uses neutral wording and offers no inputs', () => {
    render(<WhatHelpedPatterns trends={[trend('s1', 'React', [goal('g1', ['flashcards'])])]} />)
    expect(screen.queryByText(/best|most effective|worst|top method/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('does not show the student\'s own "Other" text', () => {
    const g = goal('g1', ['other'])
    g.met!.answerLabels = ['Other: pair programming with a friend']
    render(<WhatHelpedPatterns trends={[trend('s1', 'React', [g])]} />)
    expect(screen.getByText('Other')).toBeInTheDocument()
    expect(screen.queryByText(/pair programming/)).not.toBeInTheDocument()
  })
})

describe('WhatHelpedPatterns for staff', () => {
  it('uses student wording, a neutral empty note and the reading guide', () => {
    render(<WhatHelpedPatterns trends={[]} audience="student" />)
    expect(screen.getByRole('heading', { name: 'What tends to help this student' })).toBeInTheDocument()
    expect(screen.getByText(/Nothing logged yet/)).toBeInTheDocument()
    expect(screen.getByText(/not proof that a method caused it/)).toBeInTheDocument()
    expect(screen.queryByText(/\byou\b|\byour\b/i)).not.toBeInTheDocument()
  })

  it('shows class counts with how many answered goals and students it is based on, in neutral words', () => {
    const patterns = {
      answeredGoals: 4, answeredStudents: 3,
      methods: [{ value: 'flashcards', label: 'Studying flashcards', count: 4, skills: [{ skillId: 's1', name: 'React', count: 4 }] }],
    }
    render(<WhatHelpedPatterns patterns={patterns} audience="class" />)
    expect(screen.getByRole('heading', { name: 'What tends to help students' })).toBeInTheDocument()
    expect(screen.getByText('Helped 4 times')).toBeInTheDocument()
    expect(screen.getByText(/based on 4 times where students logged what helped, from 3 students/)).toBeInTheDocument()
    expect(screen.getByText(/not proof that a method caused it/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/best|most effective|worst|top method/i)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows the neutral note for a class with no answers', () => {
    render(<WhatHelpedPatterns patterns={{ answeredGoals: 0, answeredStudents: 0, methods: [] }} audience="class" />)
    expect(screen.getByText(/Nothing logged yet/)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('gives several sections on one page distinct heading ids', () => {
    render(<>
      <WhatHelpedPatterns trends={[]} audience="student" />
      <WhatHelpedPatterns trends={[]} audience="student" />
    </>)
    const ids = screen.getAllByRole('heading').map(h => h.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('compact leaves out its own heading (the caller supplies the title) but stays a named region', () => {
    render(<WhatHelpedPatterns trends={[]} audience="student" compact />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'What tends to help this student' })).toBeInTheDocument()
    expect(screen.getByText(/not proof that a method caused it/)).toBeInTheDocument()
  })
})
