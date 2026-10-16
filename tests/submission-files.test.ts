import { describe, it, expect } from 'vitest'
import {
  submissionFilePath,
  submissionFileHref,
  submissionFileName,
} from '@/lib/submission-files'

const PUBLIC = 'https://abc.supabase.co/storage/v1/object/public/lms-submissions/a1/s1/shot.png'

describe('submissionFilePath', () => {
  it('pulls the path out of a legacy public URL', () => {
    expect(submissionFilePath(PUBLIC)).toBe('a1/s1/shot.png')
  })

  it('decodes percent-encoding and drops a query string', () => {
    expect(submissionFilePath('https://abc.supabase.co/storage/v1/object/sign/lms-submissions/a1/s1/my%20file.pdf?token=x'))
      .toBe('a1/s1/my file.pdf')
  })

  it('accepts a bare storage path', () => {
    expect(submissionFilePath('a1/s1/shot.png')).toBe('a1/s1/shot.png')
  })

  it('handles the random upload folder in newer paths', () => {
    expect(submissionFilePath('a1/s1/0a1b2c3d/report.pdf')).toBe('a1/s1/0a1b2c3d/report.pdf')
    expect(submissionFilePath('https://abc.supabase.co/storage/v1/object/public/lms-submissions/a1/s1/0a1b2c3d/report.pdf'))
      .toBe('a1/s1/0a1b2c3d/report.pdf')
    expect(submissionFileName('a1/s1/0a1b2c3d/report.pdf')).toBe('report.pdf')
  })

  it('leaves URLs for other buckets and sites alone', () => {
    expect(submissionFilePath('https://abc.supabase.co/storage/v1/object/public/lms-resources/x/y.png')).toBeNull()
    expect(submissionFilePath('https://canvas.example.com/files/1/2/download')).toBeNull()
  })

  it('rejects traversal', () => {
    expect(submissionFilePath('a1/../s2/shot.png')).toBeNull()
    expect(submissionFilePath('https://abc.supabase.co/storage/v1/object/public/lms-submissions/a1/%2e%2e/x/y.png')).toBeNull()
  })
})

describe('submissionFileHref / submissionFileName', () => {
  it('routes bucket files through the access-checked endpoint', () => {
    expect(submissionFileHref(PUBLIC)).toBe('/api/submission-file?path=a1%2Fs1%2Fshot.png')
    expect(submissionFileHref('a1/s1/shot.png')).toBe('/api/submission-file?path=a1%2Fs1%2Fshot.png')
  })

  it('keeps external URLs as links', () => {
    expect(submissionFileHref('https://example.com/x.pdf')).toBe('https://example.com/x.pdf')
  })

  it('shows the file name for both forms', () => {
    expect(submissionFileName(PUBLIC)).toBe('shot.png')
    expect(submissionFileName('a1/s1/notes.pdf')).toBe('notes.pdf')
  })
})
