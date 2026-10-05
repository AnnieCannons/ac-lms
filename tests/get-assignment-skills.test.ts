import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/skill-actions', () => ({ listAssignmentSkills: vi.fn() }))

import { getAssignmentSkillsForStudent } from '@/lib/confidence-tracker-actions'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { listAssignmentSkills } from '@/lib/skill-actions'

interface Opts {
  progress?: Record<string, unknown>[]
  // Ratings, newest first (as the action orders them).
  ratings?: { skill_id: string; rating: number }[]
  goalRows?: { id: string; skill_id: string }[]
  outcomeRows?: { goal_history_id: string }[]
  ratedError?: { message: string } | null
}

// Thenable chain: every builder method returns the chain, so any select/eq/in/order shape works.
function chain(result: unknown) {
  const c: Record<string, unknown> = {}
  for (const m of ['eq', 'in', 'order']) c[m] = () => c
  c.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
  return c
}

function makeClient(opts: Opts = {}) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: (table: string) => {
      const sel = (data: unknown, error: unknown = null) => ({ select: () => chain({ data, error }) })
      if (table === 'confidence_tracker_skill_progress') return sel(opts.progress ?? [])
      if (table === 'confidence_tracker_ratings') return sel(opts.ratings ?? [], opts.ratedError ?? null)
      if (table === 'confidence_tracker_goal_history') return sel(opts.goalRows ?? [])
      if (table === 'confidence_tracker_goal_outcomes') return sel(opts.outcomeRows ?? [])
      throw new Error(`unexpected table ${table}`)
    },
  } as never)
}

const tagged = [{ id: 's1', name: 'React' }, { id: 's2', name: 'Git' }]
const progress = (over: Record<string, unknown> = {}) => ({ skill_id: 's1', goal: null, ...over })
const find = (skills: { id: string }[], id: string) => skills.find(s => s.id === id)! as never as {
  id: string; isNew: boolean; isMaintaining: boolean; canSetGoal: boolean
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listAssignmentSkills).mockResolvedValue({ error: null, skills: tagged })
})

describe('getAssignmentSkillsForStudent "New" badge', () => {
  it('marks only a skill the student has never rated as new', async () => {
    makeClient({ ratings: [{ skill_id: 's1', rating: 5 }] })
    const { skills } = await getAssignmentSkillsForStudent('a1')
    expect(find(skills, 's1').isNew).toBe(false)
    expect(find(skills, 's2').isNew).toBe(true)
  })

  it('does not show the badge on a skill rated before, even one at 10', async () => {
    makeClient({ ratings: [{ skill_id: 's1', rating: 10 }, { skill_id: 's1', rating: 10 }] })
    const { skills } = await getAssignmentSkillsForStudent('a1')
    expect(find(skills, 's1').isNew).toBe(false)
  })
})

describe('getAssignmentSkillsForStudent maintaining', () => {
  it('no longer excludes a skill after two 10s; it is returned as maintaining', async () => {
    makeClient({ ratings: [{ skill_id: 's1', rating: 10 }, { skill_id: 's1', rating: 10 }], progress: [progress({ is_mastered: true })] })
    const { skills } = await getAssignmentSkillsForStudent('a1')
    expect(skills.map(s => s.id)).toEqual(['s1', 's2'])
    expect(find(skills, 's1').isMaintaining).toBe(true)
  })

  it('is maintaining only when the LATEST rating is 10 (10 then 7 is growing again)', async () => {
    makeClient({ ratings: [{ skill_id: 's1', rating: 7 }, { skill_id: 's1', rating: 10 }] })
    const { skills } = await getAssignmentSkillsForStudent('a1')
    expect(find(skills, 's1').isMaintaining).toBe(false)
    expect(find(skills, 's2').isMaintaining).toBe(false)
  })
})

describe('getAssignmentSkillsForStudent canSetGoal', () => {
  it('is true after a dip below 10 even with an old maintain-only progress row', async () => {
    makeClient({ ratings: [{ skill_id: 's1', rating: 7 }, { skill_id: 's1', rating: 10 }], progress: [progress({ goal: null, goal_is_maintain: true })] })
    const { skills } = await getAssignmentSkillsForStudent('a1')
    expect(find(skills, 's1').canSetGoal).toBe(true)
  })

  it('is true once the current goal has been met', async () => {
    makeClient({
      ratings: [{ skill_id: 's1', rating: 8 }],
      progress: [progress({ goal: 7 })],
      goalRows: [{ id: 'g1', skill_id: 's1' }],
      outcomeRows: [{ goal_history_id: 'g1' }],
    })
    const { skills } = await getAssignmentSkillsForStudent('a1')
    expect(find(skills, 's1').canSetGoal).toBe(true)
  })

  it('is false while a numeric goal is still open', async () => {
    makeClient({
      ratings: [{ skill_id: 's1', rating: 5 }],
      progress: [progress({ goal: 7 })],
      goalRows: [{ id: 'g1', skill_id: 's1' }],
    })
    const { skills } = await getAssignmentSkillsForStudent('a1')
    expect(find(skills, 's1').canSetGoal).toBe(false)
    expect(find(skills, 's2').canSetGoal).toBe(true)
  })
})

describe('getAssignmentSkillsForStudent errors', () => {
  it('reports an error rather than guessing when the ratings lookup fails', async () => {
    makeClient({ ratedError: { message: 'boom' } })
    const result = await getAssignmentSkillsForStudent('a1')
    expect(result).toEqual({ error: 'boom', skills: [] })
  })
})
