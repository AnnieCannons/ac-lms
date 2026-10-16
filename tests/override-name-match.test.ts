import { describe, it, expect } from 'vitest'
import { matchStudentNames, splitPastedNames } from '@/lib/override-name-match'

const students = [
  { id: '1', name: 'Jane Smith' },
  { id: '2', name: 'José Ramírez' },
  { id: '3', name: 'Maria Lopez Garcia' },
  { id: '4', name: 'Sam Lee' },
  { id: '5', name: 'Sam Patel' },
  { id: '6', name: 'Aisha Khan' },
]

describe('splitPastedNames', () => {
  it('splits on newlines, commas, semicolons and tabs, dropping blanks and duplicates', () => {
    expect(splitPastedNames('Jane Smith\n\nAisha Khan, jane  smith;Sam Lee\tJosé')).toEqual([
      'Jane Smith', 'Aisha Khan', 'Sam Lee', 'José',
    ])
  })
})

describe('matchStudentNames', () => {
  it('matches full names ignoring case, accents and extra spaces', () => {
    const r = matchStudentNames('  jane   SMITH \nJose Ramirez', students)
    expect(r.matched.map(m => m.student.id)).toEqual(['1', '2'])
    expect(r.unmatched).toEqual([])
  })

  it('matches a unique first name, but flags a shared one as ambiguous', () => {
    const r = matchStudentNames('Aisha\nSam', students)
    expect(r.matched.map(m => m.student.id)).toEqual(['6'])
    expect(r.ambiguous).toEqual([{ input: 'Sam', candidates: [students[3], students[4]] }])
  })

  it('matches when a middle name is left out', () => {
    expect(matchStudentNames('Maria Garcia', students).matched[0].student.id).toBe('3')
  })

  it('reports names it cannot find', () => {
    expect(matchStudentNames('Jane Doe\nBob', students).unmatched).toEqual(['Jane Doe', 'Bob'])
  })

  it('lists a student once even when pasted two different ways', () => {
    const r = matchStudentNames('Jane Smith\nJane', students)
    expect(r.matched).toHaveLength(1)
  })
})
