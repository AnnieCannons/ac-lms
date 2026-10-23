import { describe, it, expect } from 'vitest'
import { highlightCodeHtml } from '@/lib/highlight-code-html'

describe('highlightCodeHtml', () => {
  it('highlights a code block in its chosen language', () => {
    const out = highlightCodeHtml('<pre><code class="language-css">img { width: 200px; }</code></pre>')
    expect(out).toContain('class="language-css hljs"')
    expect(out).toContain('hljs-selector-tag')
    expect(out).toContain('200px')
  })

  it('auto-detects blocks with no language', () => {
    const out = highlightCodeHtml('<pre><code>const x = 1;</code></pre>')
    expect(out).toContain('class="hljs"')
    expect(out).toContain('<span')
  })

  it('keeps escaped markup escaped', () => {
    const out = highlightCodeHtml('<pre><code class="language-html">&lt;img src=x onerror=alert(1)&gt;</code></pre>')
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;')
  })

  it('leaves text, inline code and blocks with markup inside alone', () => {
    const html = '<p>Use <code>top: 0</code></p><pre><code>a <span class="cloze-target">b</span></code></pre>'
    expect(highlightCodeHtml(html)).toBe(html)
  })
})
