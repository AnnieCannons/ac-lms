import { describe, it, expect } from 'vitest'
import { normalizeSkillName } from '@/lib/skill-normalize'

describe('normalizeSkillName', () => {
  it('is case-insensitive', () => {
    expect(normalizeSkillName('JS')).toBe(normalizeSkillName('js'))
  })

  it('collapses internal whitespace and punctuation differences', () => {
    expect(normalizeSkillName('Node.js')).toBe(normalizeSkillName('Node JS'))
    expect(normalizeSkillName('Node.js')).toBe(normalizeSkillName('node  js'))
  })

  it('trims leading/trailing whitespace', () => {
    expect(normalizeSkillName('React ')).toBe(normalizeSkillName('React'))
  })

  it('produces an empty string for whitespace-only or empty input', () => {
    expect(normalizeSkillName('   ')).toBe('')
    expect(normalizeSkillName('')).toBe('')
  })

  it('does not collapse genuinely different skill names', () => {
    expect(normalizeSkillName('React')).not.toBe(normalizeSkillName('Redux'))
  })
})
