import { describe, it, expect } from 'vitest'
import { computeKudos, latestPriorRatingBySkill } from '@/lib/confidence-kudos'

const existing = { is_new_pending: false }
const progress = (...ids: string[]) => new Map(ids.map(id => [id, existing]))

describe('latestPriorRatingBySkill', () => {
  it('picks the most recent rating per skill across courses', () => {
    const map = latestPriorRatingBySkill([
      { id: 'a', skill_id: 's1', rating: 3, created_at: '2026-01-01T00:00:00Z' },
      { id: 'b', skill_id: 's1', rating: 7, created_at: '2026-03-01T00:00:00Z' },
      { id: 'c', skill_id: 's1', rating: 5, created_at: '2026-02-01T00:00:00Z' },
      { id: 'd', skill_id: 's2', rating: 2, created_at: '2026-02-01T00:00:00Z' },
    ])
    expect(map.get('s1')).toBe(7)
    expect(map.get('s2')).toBe(2)
  })

  it('breaks identical timestamps by the larger id, independent of input order', () => {
    const t = '2026-01-01T00:00:00Z'
    const rows = [
      { id: 'a', skill_id: 's1', rating: 3, created_at: t },
      { id: 'b', skill_id: 's1', rating: 8, created_at: t },
    ]
    expect(latestPriorRatingBySkill(rows).get('s1')).toBe(8)
    expect(latestPriorRatingBySkill([...rows].reverse()).get('s1')).toBe(8)
  })
})

describe('computeKudos', () => {
  it('counts an increase of just +1', () => {
    expect(computeKudos([{ skillId: 's1', rating: 6 }], new Map([['s1', 5]]), progress('s1'))).toEqual([
      { skillId: 's1', from: 5, to: 6 },
    ])
  })

  it('gives nothing for equal or lower ratings', () => {
    const prior = new Map([['s1', 5], ['s2', 5]])
    expect(
      computeKudos([{ skillId: 's1', rating: 5 }, { skillId: 's2', rating: 4 }], prior, progress('s1', 's2'))
    ).toEqual([])
  })

  it('gives nothing without an earlier rating', () => {
    expect(computeKudos([{ skillId: 's1', rating: 9 }], new Map(), progress('s1'))).toEqual([])
  })

  it('gives nothing for the first rating after a reactivation (is_new_pending)', () => {
    const p = new Map([['s1', { is_new_pending: true }]])
    expect(computeKudos([{ skillId: 's1', rating: 9 }], new Map([['s1', 3]]), p)).toEqual([])
  })

  it('gives nothing when there is no progress row', () => {
    expect(computeKudos([{ skillId: 's1', rating: 9 }], new Map([['s1', 3]]), new Map())).toEqual([])
  })

  it('returns several improved skills together, in submitted order, skipping the rest', () => {
    const prior = new Map([['s1', 2], ['s2', 8], ['s3', 4]])
    const result = computeKudos(
      [{ skillId: 's3', rating: 6 }, { skillId: 's2', rating: 7 }, { skillId: 's1', rating: 3 }],
      prior,
      progress('s1', 's2', 's3')
    )
    expect(result.map(r => r.skillId)).toEqual(['s3', 's1'])
  })

  it('does not treat 10 after 10 as an increase', () => {
    expect(computeKudos([{ skillId: 's1', rating: 10 }], new Map([['s1', 10]]), progress('s1'))).toEqual([])
  })
})
