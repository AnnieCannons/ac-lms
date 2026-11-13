import { describe, it, expect, beforeEach } from 'vitest'
import { readFlashcardsReturn, rememberFlashcardsReturn, returnLabel, safeReturnPath } from '@/lib/flashcards/return-to'

describe('safeReturnPath', () => {
  it('accepts course pages in the app', () => {
    expect(safeReturnPath('/student/courses/abc-123/level-up')).toBe('/student/courses/abc-123/level-up')
    expect(safeReturnPath('/instructor/courses/abc-123/level-up')).toBe('/instructor/courses/abc-123/level-up')
  })
  it('rejects anything else', () => {
    expect(safeReturnPath(null)).toBeNull()
    expect(safeReturnPath('https://evil.example')).toBeNull()
    expect(safeReturnPath('//evil.example/student/courses/x')).toBeNull()
    expect(safeReturnPath('/flashcards')).toBeNull()
    expect(safeReturnPath('/student/courses/x/../../admin')).toBeNull()
  })
})

describe('returnLabel', () => {
  it('names where Back goes', () => {
    expect(returnLabel('/student/courses/x/level-up')).toBe('Back to Level Up')
    expect(returnLabel('/student/courses/x')).toBe('Back to Course')
    expect(returnLabel(null)).toBe('Back to Home')
  })
})

describe('remembering the Level Up page', () => {
  beforeEach(() => sessionStorage.clear())

  it('keeps the last safe origin for the tab', () => {
    rememberFlashcardsReturn('/student/courses/x/level-up')
    rememberFlashcardsReturn(null)
    rememberFlashcardsReturn('https://evil.example')
    expect(readFlashcardsReturn()).toBe('/student/courses/x/level-up')
  })
})
