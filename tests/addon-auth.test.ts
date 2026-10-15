import { describe, it, expect, afterEach } from 'vitest'
import { checkAddonApiKey } from '@/lib/partnerships/addon-auth'

const req = (key?: string) => new Request('http://localhost/api/partnerships/search', key ? { headers: { 'x-addon-api-key': key } } : {})

afterEach(() => { delete process.env.ADDON_API_KEY })

describe('checkAddonApiKey', () => {
  it('accepts the right key and rejects wrong, shorter, longer and missing keys', () => {
    process.env.ADDON_API_KEY = 'secret-key'
    expect(checkAddonApiKey(req('secret-key'))).toBe(true)
    expect(checkAddonApiKey(req('secret-kez'))).toBe(false)
    expect(checkAddonApiKey(req('secret'))).toBe(false)
    expect(checkAddonApiKey(req('secret-key-and-more'))).toBe(false)
    expect(checkAddonApiKey(req())).toBe(false)
  })

  it('fails closed when ADDON_API_KEY is unset', () => {
    expect(checkAddonApiKey(req('anything'))).toBe(false)
  })
})
