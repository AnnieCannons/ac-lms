import { describe, it, expect } from 'vitest'
import { collapseDoubleClicks } from '@/lib/grade-history'

const e = (id: string, grade: string, graded_at: string) => ({ id, grade, graded_at })

describe('collapseDoubleClicks', () => {
  it('keeps a second return after a resubmission (Pumpkin Pie, Sep 30)', () => {
    const history = [
      e('a', 'incomplete', '2026-09-30T17:06:00Z'),
      e('b', 'incomplete', '2026-09-30T17:57:00Z'),
      e('c', 'complete', '2026-09-30T18:34:00Z'),
    ]
    expect(collapseDoubleClicks(history).map(x => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('collapses a double-click to the first entry, in any input order', () => {
    const desc = [
      e('c', 'complete', '2026-09-30T18:00:00Z'),
      e('b', 'incomplete', '2026-09-30T17:00:40Z'),
      e('a', 'incomplete', '2026-09-30T17:00:00Z'),
    ]
    expect(collapseDoubleClicks(desc).map(x => x.id)).toEqual(['c', 'a'])
  })

  it('collapses a rapid triple-click', () => {
    const history = [
      e('a', 'incomplete', '2026-09-30T17:00:00Z'),
      e('b', 'incomplete', '2026-09-30T17:01:00Z'),
      e('c', 'incomplete', '2026-09-30T17:02:30Z'),
    ]
    expect(collapseDoubleClicks(history).map(x => x.id)).toEqual(['a'])
  })

  it('never collapses different grades', () => {
    const history = [
      e('a', 'incomplete', '2026-09-30T17:00:00Z'),
      e('b', 'complete', '2026-09-30T17:00:10Z'),
    ]
    expect(collapseDoubleClicks(history)).toHaveLength(2)
  })
})
