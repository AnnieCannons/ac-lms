// Syntax-highlights the code blocks in already-sanitized editor HTML for display, matching
// the editors' highlighted code blocks. String-based (no DOM), so server and client render
// the same markup. Colours come from the global highlight.js theme (atom-one-dark).
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import sql from 'highlight.js/lib/languages/sql'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('jsx', javascript)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('sql', sql)

const CODE_BLOCK = /<pre([^>]*)><code([^>]*)>([^<]*)<\/code><\/pre>/g

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')

/**
 * Only plain-text code blocks are touched (anything with markup inside, e.g. fill-in-the-blank
 * spans, is left as is). A language-x class picks the grammar; without one it's auto-detected.
 * highlight.js escapes the code itself, so the output is as safe as the sanitized input.
 */
export function highlightCodeHtml(html: string): string {
  if (!html.includes('<pre')) return html
  return html.replace(CODE_BLOCK, (whole, preAttrs: string, codeAttrs: string, body: string) => {
    const text = decode(body)
    if (!text.trim()) return whole
    const lang = /\blanguage-([\w-]+)/.exec(codeAttrs)?.[1]
    try {
      const value = lang && hljs.getLanguage(lang)
        ? hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
        : hljs.highlightAuto(text).value
      const cls = /\bclass="([^"]*)"/.exec(codeAttrs)?.[1]
      const attrs = cls ? codeAttrs.replace(/\bclass="[^"]*"/, `class="${cls} hljs"`) : `${codeAttrs} class="hljs"`
      return `<pre${preAttrs}><code${attrs}>${value}</code></pre>`
    } catch {
      return whole
    }
  })
}
