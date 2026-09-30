import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: vi.fn(), createServiceSupabaseClient: vi.fn() }))
vi.mock('@/lib/skill-actions', () => ({ listAssignmentSkills: vi.fn() }))

import { getAssignmentSkillsForStudent } from '@/lib/confidence-tracker-actions'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { listAssignmentSkills } from '@/lib/skill-actions'

interface Opts {
  progress?: Record<string, unknown>[]
  ratedSkillIds?: string[]
  ratedError?: { message: string } | null
}

function makeClient(opts: Opts = {}) {
  const inResult = (data: unknown, error: unknown = null) => ({ select: () => ({ eq: () => ({ in: async () => ({ data, error }) }) }) })
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: (table: string) => {
      if (table === 'confidence_tracker_skill_progress') return inResult(opts.progress ?? [])
      if (table === 'confidence_tracker_ratings') return inResult((opts.ratedSkillIds ?? []).map(skill_id => ({ skill_id })), opts.ratedError ?? null)
      throw new Error(`unexpected table ${table}`)
    },
  } as never)
}

const tagged = [{ id: 's1', name: 'React' }, { id: 's2', name: 'Git' }]
const progress = (over: Record<string, unknown> = {}) => ({
  skill_id: 's1', is_new_pending: false, goal: null, goal_is_maintain: false, is_mastered: false, ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listAssignmentSkills).mockResolvedValue({ error: null, skills: tagged })
})

describe('getAssignmentSkillsForStudent "New" badge', () => {
  it('marks a skill the student has never rated as new', async () => {
    makeClient({ ratedSkillIds: [] })
    const { skills } = await getAssignmentSkillsForStudent('a1')
    expect(skills.map(s => [s.id, s.isNew])).toEqual([['s1', true], ['s2', true]])
  })

  it('does not mark a skill the student has rated before as new', async () => {
    makeClient({ ratedSkillIds: ['s1'], progress: [progress()] })
    const { skills } = await getAssignmentSkillsForStudent('a1')
    expect(skills.find(s => s.id === 's1')!.isNew).toBe(false)
    expect(skills.find(s => s.id === 's2')!.isNew).toBe(true)
  })

  it('does not show the badge for a reactivated skill, but still offers goal-setting again', async () => {
    // Reactivation: progress row is new-pending with its goal cleared, but earlier ratings exist.
    makeClient({ ratedSkillIds: ['s1'], progress: [progress({ is_new_pending: true })] })
    const { skills } = await getAssignmentSkillsForStudent('a1')
    const react = skills.find(s => s.id === 's1')!
    expect(react.isNew).toBe(false)
    expect(react.canSetGoal).toBe(true)
  })

  it('still excludes a mastered skill', async () => {
    makeClient({ ratedSkillIds: ['s1'], progress: [progress({ is_mastered: true })] })
    const { skills } = await getAssignmentSkillsForStudent('a1')
    expect(skills.map(s => s.id)).toEqual(['s2'])
  })

  it('reports an error rather than guessing when the ratings lookup fails', async () => {
    makeClient({ ratedError: { message: 'boom' } })
    const result = await getAssignmentSkillsForStudent('a1')
    expect(result).toEqual({ error: 'boom', skills: [] })
  })
})
