import { describe, it, expect } from 'vitest'
import {
  isValidTargetDate,
  validateGoalInput,
  validateWhatHelped,
  OTHER_TEXT_MAX_LENGTH,
  OWN_PLAN_VALUE,
  type StudyPlan,
} from '@/lib/confidence-tracker-validation'

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
      targetDate: '2026-09-29',
      studyPlan: ['flashcards'],
      studyPlanOther: null,
    })
  })

  it('accepts more than one study plan value at once', () => {
    expect(validateGoalInput(5, { goal: 7, targetDate: '2026-09-29', studyPlan: ['flashcards', 'ta_help'] }, TODAY)).toEqual({
      goal: 7,
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

  it('rejects any goal when the rating is 10, numeric or otherwise', () => {
    expect(validateGoalInput(10, { ...base, goal: 10 }, TODAY)).toBeNull()
    expect(validateGoalInput(10, { ...base, goal: 11 }, TODAY)).toBeNull()
  })

  it('does not accept the old "maintain" goal, at any rating', () => {
    // @ts-expect-error 'maintain' is no longer a valid goal input
    expect(validateGoalInput(10, { goal: 'maintain' }, TODAY)).toBeNull()
    // @ts-expect-error 'maintain' is no longer a valid goal input
    expect(validateGoalInput(9, { ...base, goal: 'maintain' }, TODAY)).toBeNull()
  })

  it('never returns a goalIsMaintain field', () => {
    expect(validateGoalInput(5, { ...base, goal: 6 }, TODAY)).not.toHaveProperty('goalIsMaintain')
  })

  it('rejects study plan "other" with a blank free-text field', () => {
    expect(validateGoalInput(5, { goal: 7, targetDate: '2026-09-29', studyPlan: ['other'], studyPlanOther: '   ' }, TODAY)).toBeNull()
  })

  it('accepts study plan "other" with trimmed free-text', () => {
    expect(
      validateGoalInput(5, { goal: 7, targetDate: '2026-09-29', studyPlan: ['other'], studyPlanOther: '  Pairing with a TA  ' }, TODAY)
    ).toEqual({
      goal: 7,
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

describe('"Other" write-in length', () => {
  const base = { goal: 7, targetDate: '2026-10-05', studyPlan: ['other' as StudyPlan] }
  it('accepts up to the shared limit and rejects longer text', () => {
    expect(validateGoalInput(5, { ...base, studyPlanOther: 'x'.repeat(OTHER_TEXT_MAX_LENGTH) }, TODAY)).not.toBeNull()
    expect(validateGoalInput(5, { ...base, studyPlanOther: 'x'.repeat(OTHER_TEXT_MAX_LENGTH + 1) }, TODAY)).toBeNull()
  })
})

describe('validateWhatHelped', () => {
  it('accepts one or more known options and drops duplicates', () => {
    expect(validateWhatHelped(['flashcards', 'ta_help', 'flashcards'], undefined, null)).toEqual({
      whatHelped: ['flashcards', 'ta_help'],
      other: null,
    })
  })
  it('rejects nothing chosen, unknown values and non-arrays', () => {
    expect(validateWhatHelped([], undefined, null)).toBeNull()
    expect(validateWhatHelped(['nope'], undefined, null)).toBeNull()
    expect(validateWhatHelped('flashcards', undefined, null)).toBeNull()
  })
  it('requires a non-blank, length-limited write-in when "Other" is chosen, and ignores it otherwise', () => {
    expect(validateWhatHelped(['other'], '  ', null)).toBeNull()
    expect(validateWhatHelped(['other'], undefined, null)).toBeNull()
    expect(validateWhatHelped(['other'], 'x'.repeat(OTHER_TEXT_MAX_LENGTH + 1), null)).toBeNull()
    expect(validateWhatHelped(['other'], '  A study group  ', null)).toEqual({ whatHelped: ['other'], other: 'A study group' })
    expect(validateWhatHelped(['flashcards'], 'abandoned text', null)?.other).toBeNull()
  })
  it('offers the student\'s own study-plan text only when that goal had one', () => {
    expect(validateWhatHelped([OWN_PLAN_VALUE], undefined, null)).toBeNull()
    expect(validateWhatHelped([OWN_PLAN_VALUE], undefined, '   ')).toBeNull()
    expect(validateWhatHelped([OWN_PLAN_VALUE], undefined, 'Pair with a friend')).toEqual({ whatHelped: [OWN_PLAN_VALUE], other: null })
  })
})
