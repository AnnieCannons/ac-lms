import { describe, it, expect } from 'vitest'
import { quizBelongsToDay, moduleTitleSet } from '@/lib/quiz-day-match'

// Mirrors Advanced Frontend (Fall 2026): a placeholder "Career Week" module holds
// week_number 4, so every later module's week_number is one ahead of its title.
const modules = [
  { title: 'Week 4: Career Week (none in Fall 2026)', week_number: 4 },
  { title: 'Week 4: More Loops + Functions + Scope', week_number: 5 },
  { title: 'Week 5: APIs', week_number: 6 },
]
const titles = moduleTitleSet(modules)
const tuesday = { id: 'day-tue', day_name: 'Tuesday' }
const quiz = { module_title: 'Week 5: APIs', day_title: 'Tuesday', linked_day_id: null }

describe('quizBelongsToDay', () => {
  it('shows a quiz on the module whose title matches exactly', () => {
    expect(quizBelongsToDay(quiz, tuesday, modules[2], titles)).toBe(true)
  })

  it('does not also show it on a module whose week_number happens to match the title', () => {
    expect(quizBelongsToDay(quiz, tuesday, modules[1], titles)).toBe(false)
  })

  it('falls back to week_number when no module has the quiz\'s title (module renamed)', () => {
    const renamed = { ...quiz, module_title: 'Week 6: Old Name' }
    expect(quizBelongsToDay(renamed, tuesday, modules[2], titles)).toBe(true)
    expect(quizBelongsToDay(renamed, tuesday, modules[1], titles)).toBe(false)
  })

  it('requires the day name to match', () => {
    expect(quizBelongsToDay(quiz, { id: 'day-wed', day_name: 'Wednesday' }, modules[2], titles)).toBe(false)
  })

  it('always shows a quiz cross-posted to this exact day', () => {
    const crossPosted = { module_title: 'Job Related- Career Development', day_title: 'Monday', linked_day_id: 'day-tue' }
    expect(quizBelongsToDay(crossPosted, tuesday, modules[0], titles)).toBe(true)
  })

  it('ignores surrounding whitespace in titles', () => {
    expect(quizBelongsToDay({ ...quiz, module_title: ' Week 5: APIs ' }, tuesday, modules[2], titles)).toBe(true)
  })
})
