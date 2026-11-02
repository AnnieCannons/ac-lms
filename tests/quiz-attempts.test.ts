import { describe, it, expect } from 'vitest'
import { dedupeAttemptHistory, isDuplicateAttempt } from '@/lib/quiz-attempts'

const t = (s: string) => `2026-11-02T16:${s}Z`

describe('isDuplicateAttempt', () => {
  const prev = { started_at: t('50:00'), submitted_at: t('53:49'), score_percent: 100 }

  it('flags a same-score submit seconds later with no start time', () => {
    expect(isDuplicateAttempt(prev, { started_at: null, submitted_at: t('53:51'), score_percent: 100 })).toBe(true)
  })

  it('keeps a real retake, which always has a start time', () => {
    expect(isDuplicateAttempt(prev, { started_at: t('53:50'), submitted_at: t('53:55'), score_percent: 100 })).toBe(false)
  })

  it('keeps a different score or a later submit', () => {
    expect(isDuplicateAttempt(prev, { started_at: null, submitted_at: t('53:51'), score_percent: 88 })).toBe(false)
    expect(isDuplicateAttempt(prev, { started_at: null, submitted_at: t('54:30'), score_percent: 100 })).toBe(false)
  })
})

describe('dedupeAttemptHistory', () => {
  it('collapses a run of clicks into one attempt and renumbers', () => {
    const history = [
      { attempt: 1, started_at: t('40:52'), submitted_at: t('50:47'), score_percent: 50 },
      { attempt: 2, started_at: t('52:28'), submitted_at: t('53:49'), score_percent: 100 },
      { attempt: 3, started_at: null, submitted_at: t('53:51'), score_percent: 100 },
      { attempt: 4, started_at: null, submitted_at: t('53:53'), score_percent: 100 },
      { attempt: 5, started_at: null, submitted_at: t('53:56'), score_percent: 100 },
    ]
    const { history: kept, removed } = dedupeAttemptHistory(history)
    expect(removed).toBe(3)
    expect(kept.map(h => [h.attempt, h.submitted_at])).toEqual([[1, t('50:47')], [2, t('53:49')]])
  })

  it('leaves a clean history alone', () => {
    const history = [
      { attempt: 1, started_at: t('07:59'), submitted_at: t('09:16'), score_percent: 63 },
      { attempt: 2, started_at: t('09:22'), submitted_at: t('09:43'), score_percent: 88 },
    ]
    expect(dedupeAttemptHistory(history)).toEqual({ history, removed: 0 })
  })
})
