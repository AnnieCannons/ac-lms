import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { toggleCodeBlockMerged } from '@/lib/tiptap-code-block'

let editor: Editor | null = null
afterEach(() => { editor?.destroy(); editor = null })

const make = (content: string) => {
  // No trailing paragraph, so the expected HTML stays readable.
  editor = new Editor({ extensions: [StarterKit.configure({ trailingNode: false })], content })
  return editor
}

describe('toggleCodeBlockMerged', () => {
  it('turns several selected lines into one code block', () => {
    const ed = make('<p>Intro</p><p>selector {</p><p>top: 0</p><p>}</p>')
    // From inside "selector {" to the end of "}".
    ed.commands.setTextSelection({ from: 9, to: ed.state.doc.content.size - 1 })
    toggleCodeBlockMerged(ed)
    expect(ed.getHTML()).toBe('<p>Intro</p><pre><code>selector {\ntop: 0\n}</code></pre>')
  })

  it('merges code blocks that were split one per line', () => {
    const ed = make('<pre><code>a {</code></pre><pre><code>  top: 0</code></pre><pre><code>}</code></pre>')
    ed.commands.selectAll()
    toggleCodeBlockMerged(ed)
    expect(ed.getHTML()).toBe('<pre><code>a {\n  top: 0\n}</code></pre>')
  })

  it('leaves out empty lines at the end of the selection', () => {
    const ed = make('<p>a {</p><p>}</p><p></p>')
    ed.commands.selectAll()
    toggleCodeBlockMerged(ed)
    expect(ed.getHTML()).toBe('<pre><code>a {\n}</code></pre><p></p>')
  })

  it('still toggles a single line on and off', () => {
    const ed = make('<p>top: 0</p>')
    ed.commands.setTextSelection(3)
    toggleCodeBlockMerged(ed)
    expect(ed.getHTML()).toBe('<pre><code>top: 0</code></pre>')
    toggleCodeBlockMerged(ed)
    expect(ed.getHTML()).toBe('<p>top: 0</p>')
  })
})
