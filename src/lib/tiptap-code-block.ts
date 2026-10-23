import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * The ``` toolbar button. Tiptap's toggleCodeBlock turns each selected line into its own code
 * block, so a selection spanning several lines (paragraphs, or code blocks split that way
 * earlier) is merged into ONE code block, one line per original block. A single block still
 * toggles normally (on, or off when it's already a code block).
 */
export function toggleCodeBlockMerged(editor: Editor): boolean {
  const { state } = editor
  const { from, to } = state.selection
  const blocks: { node: PMNode; pos: number }[] = []
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock) {
      blocks.push({ node, pos })
      return false
    }
    return true
  })
  // Drop empty lines at the edges (e.g. the editor's own trailing paragraph caught by a drag or select-all).
  while (blocks.length > 1 && blocks[blocks.length - 1].node.content.size === 0) blocks.pop()
  while (blocks.length > 1 && blocks[0].node.content.size === 0) blocks.shift()

  // Only merge siblings; blocks spread across list items etc. keep tiptap's own behaviour.
  const parent = blocks.length > 1 ? state.doc.resolve(blocks[0].pos).parent : null
  const siblings = parent != null && blocks.every(b => state.doc.resolve(b.pos).parent === parent)
  if (!siblings) return editor.chain().focus().toggleCodeBlock().run()

  const codeBlock = state.schema.nodes.codeBlock
  if (!codeBlock) return false
  const text = blocks.map(b => b.node.textBetween(0, b.node.content.size, '\n', '\n')).join('\n')
  const start = blocks[0].pos
  const last = blocks[blocks.length - 1]
  const end = last.pos + last.node.nodeSize

  const tr = state.tr.replaceWith(start, end, codeBlock.create(null, text ? state.schema.text(text) : null))
  tr.setSelection(TextSelection.create(tr.doc, start + 1 + text.length))
  editor.view.dispatch(tr.scrollIntoView())
  editor.commands.focus()
  return true
}
