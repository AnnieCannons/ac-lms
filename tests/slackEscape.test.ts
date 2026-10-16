import { describe, it, expect } from 'vitest'
import { slackEscape } from '@/lib/slack'

describe('slackEscape', () => {
  it('neutralises channel pings and links in user-supplied names', () => {
    expect(slackEscape('<!channel> <https://evil.example|View>')).toBe('&lt;!channel&gt; &lt;https://evil.example|View&gt;')
  })
  it('escapes & first so existing text round-trips', () => {
    expect(slackEscape('Tom & Jerry')).toBe('Tom &amp; Jerry')
  })
})
