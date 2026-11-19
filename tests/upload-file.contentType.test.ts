import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }))

import { uploadContentType } from '@/lib/upload-file'

describe('uploadContentType', () => {
  it("keeps the browser's type when there is one", () => {
    expect(uploadContentType(new File([''], 'site.zip', { type: 'application/x-zip-compressed' }))).toBe('application/x-zip-compressed')
  })

  it('fills in an empty type from the extension', () => {
    expect(uploadContentType(new File([''], 'project.tar.gz'))).toBe('application/gzip')
    expect(uploadContentType(new File([''], 'Site.ZIP'))).toBe('application/zip')
    expect(uploadContentType(new File([''], 'deck.pptx'))).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation')
  })

  it('leaves an unknown extension empty, so the server still refuses it', () => {
    expect(uploadContentType(new File([''], 'run.exe'))).toBe('')
  })
})
