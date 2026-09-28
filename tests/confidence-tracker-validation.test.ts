import { describe, it, expect } from 'vitest'
import { isValidTargetDate, validateGoalInput, nextMasteryState, type StudyPlan } from '@/lib/confidence-tracker-validation'

const TODAY = new Date('2026-09-28T12:00:00')

describe('isValidTargetDate', () => {
  it('rejects today', () => {
    expect(isValidTargetDate('2026-09-28', TODAY)).toBe(false)
  })
  it('accepts tomorrow', () => {
    expect(isValidTargetDate('2026-09-29', TODAY)).toBe(true)
  })
  it('accepts far-future dates with no upper bound', () => {
    expect(isValidTargetDate('2026-10-12', TODAY)).toBe(true)
    expect(isValidTargetDate('2027-09-28', TODAY)).toBe(true)
  })
  it('rejects a past date', () => {
    expect(isValidTargetDate('2026-09-01', TODAY)).toBe(false)
  })
  it('rejects a malformed string', () => {
    expect(isValidTargetDate('not-a-date', TODAY)).toBe(false)
    expect(isValidTargetDate('09/29/2026', TODAY)).toBe(false)
  })
})

describe('validateGoalInput', () => {
  const base = { targetDate: '2026-09-29', studyPlan: ['flashcards'] as StudyPlan[] }

  it('accepts a goal at rating + 1 (the floor)', () => {
    expect(validateGoalInput(5, { ...base, goal: 6 }, TODAY)).toEqual({
      goal: 6,
      goalIsMaintain: false,
      targetDate: '2026-09-29',
      studyPlan: ['flashcards'],
      studyPlanOther: null,
    })
  })

  it('accepts more than one study plan value at once', () => {
    expect(validateGoalInput(5, { goal: 7, targetDate: '2026-09-29', studyPlan: ['flashcards', 'ta_help'] }, TODAY)).toEqual({
      goal: 7,
      goalIsMaintain: false,
      targetDate: '2026-09-29',
      studyPlan: ['flashcards', 'ta_help'],
      studyPlanOther: null,
    })
  })

  it('rejects an empty study plan array', () => {
    expect(validateGoalInput(5, { goal: 7, targetDate: '2026-09-29', studyPlan: [] }, TODAY)).toBeNull()
  })

  it('accepts the default rating + 2 suggestion', () => {
    expect(validateGoalInput(5, { ...base, goal: 7 }, TODAY)).toMatchObject({ goal: 7 })
  })

  it('accepts a goal of 10 for a rating of 9', () => {
    expect(validateGoalInput(9, { ...base, goal: 10 }, TODAY)).toMatchObject({ goal: 10 })
  })

  it('rejects a goal equal to the current rating', () => {
    expect(validateGoalInput(5, { ...base, goal: 5 }, TODAY)).toBeNull()
  })

  it('rejects a goal below the current rating', () => {
    expect(validateGoalInput(5, { ...base, goal: 3 }, TODAY)).toBeNull()
  })

  it('rejects a goal above 10', () => {
    expect(validateGoalInput(9, { ...base, goal: 11 }, TODAY)).toBeNull()
  })

  it('accepts "maintain" when the rating is 10, carrying no target date or study plan', () => {
    expect(validateGoalInput(10, { goal: 'maintain' }, TODAY)).toEqual({
      goal: null,
      goalIsMaintain: true,
      targetDate: null,
      studyPlan: null,
      studyPlanOther: null,
    })
  })

  it('rejects a numeric goal when the rating is 10', () => {
    expect(validateGoalInput(10, { ...base, goal: 10 }, TODAY)).toBeNull()
  })

  it('rejects "maintain" when the rating is below 10', () => {
    expect(validateGoalInput(9, { ...base, goal: 'maintain' }, TODAY)).toBeNull()
  })

  it('rejects study plan "other" with a blank free-text field', () => {
    expect(validateGoalInput(5, { goal: 7, targetDate: '2026-09-29', studyPlan: ['other'], studyPlanOther: '   ' }, TODAY)).toBeNull()
  })

  it('accepts study plan "other" with trimmed free-text', () => {
    expect(
      validateGoalInput(5, { goal: 7, targetDate: '2026-09-29', studyPlan: ['other'], studyPlanOther: '  Pairing with a TA  ' }, TODAY)
    ).toEqual({
      goal: 7,
      goalIsMaintain: false,
      targetDate: '2026-09-29',
      studyPlan: ['other'],
      studyPlanOther: 'Pairing with a TA',
    })
  })

  it('requires free-text when "other" is included alongside other values', () => {
    expect(
      validateGoalInput(5, { goal: 7, targetDate: '2026-09-29', studyPlan: ['flashcards', 'other'] }, TODAY)
    ).toBeNull()
    expect(
      validateGoalInput(5, { goal: 7, targetDate: '2026-09-29', studyPlan: ['flashcards', 'other'], studyPlanOther: 'Group study' }, TODAY)
    ).toEqual({
      goal: 7,
      goalIsMaintain: false,
      targetDate: '2026-09-29',
      studyPlan: ['flashcards', 'other'],
      studyPlanOther: 'Group study',
    })
  })

  it('rejects an unrecognized study plan value', () => {
    // @ts-expect-error deliberately invalid input, as a client could send
    expect(validateGoalInput(5, { ...base, goal: 7, studyPlan: ['something-else'] }, TODAY)).toBeNull()
  })

  it('rejects an invalid target date', () => {
    expect(validateGoalInput(5, { goal: 7, targetDate: '2020-01-01', studyPlan: ['flashcards'] }, TODAY)).toBeNull()
  })

  it('returns null when no goal input is given', () => {
    expect(validateGoalInput(5, undefined, TODAY)).toBeNull()
  })
})

describe('nextMasteryState', () => {
  it('leaves the count unchanged for a non-10 rating', () => {
    expect(nextMasteryState(0, false, 7)).toEqual({ tenRatingCount: 0, isMastered: false, justMastered: false })
  })

  it('increments the count on a first rating of 10, without mastering yet', () => {
    expect(nextMasteryState(0, false, 10)).toEqual({ tenRatingCount: 1, isMastered: false, justMastered: false })
  })

  it('masters the skill on the second rating of 10', () => {
    expect(nextMasteryState(1, false, 10)).toEqual({ tenRatingCount: 2, isMastered: true, justMastered: true })
  })

  it('is idempotent once already mastered — a later rating never re-triggers justMastered', () => {
    expect(nextMasteryState(2, true, 10)).toEqual({ tenRatingCount: 2, isMastered: true, justMastered: false })
  })

  it('leaves an already-mastered skill\'s count untouched even for a non-10 rating', () => {
    expect(nextMasteryState(2, true, 5)).toEqual({ tenRatingCount: 2, isMastered: true, justMastered: false })
  })
})
