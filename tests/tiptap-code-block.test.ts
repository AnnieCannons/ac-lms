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

describe('toggleCodeBlockMerged with line breaks inside one paragraph', () => {
  // Pasted or Shift+Enter text: one paragraph, lines separated by <br>.
  const comment = '<p>Nice work!<br>.cards {<br>gap: 0;<br>}<br>Thanks</p>'
  const posOf = (ed: Editor, text: string) => {
    let found = -1
    ed.state.doc.descendants((node, pos) => {
      if (found === -1 && node.isText && node.text!.includes(text)) found = pos + node.text!.indexOf(text)
    })
    return found
  }

  it('only turns the selected lines into a code block', () => {
    const ed = make(comment)
    ed.commands.setTextSelection({ from: posOf(ed, '.cards'), to: posOf(ed, '}') + 1 })
    toggleCodeBlockMerged(ed)
    expect(ed.getHTML()).toBe('<p>Nice work!</p><pre><code>.cards {\ngap: 0;\n}</code></pre><p>Thanks</p>')
  })

  it('takes the whole line when the selection starts or ends mid-line', () => {
    const ed = make(comment)
    ed.commands.setTextSelection({ from: posOf(ed, 'cards'), to: posOf(ed, 'gap') + 2 })
    toggleCodeBlockMerged(ed)
    expect(ed.getHTML()).toBe('<p>Nice work!</p><pre><code>.cards {\ngap: 0;</code></pre><p>}<br>Thanks</p>')
  })

  it('keeps all lines when the whole paragraph is selected', () => {
    const ed = make('<p>a {<br>}</p>')
    ed.commands.selectAll()
    toggleCodeBlockMerged(ed)
    expect(ed.getHTML()).toBe('<pre><code>a {\n}</code></pre>')
  })
})
