import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * The ``` toolbar button. Tiptap's toggleCodeBlock turns each selected line into its own code
 * block, so a selection spanning several lines (paragraphs, or code blocks split that way
 * earlier) is merged into ONE code block, one line per original block. A single block still
 * toggles normally (on, or off when it's already a code block).
 *
 * Lines inside one paragraph that are split by line breaks (<br>, from pasting or Shift+Enter)
 * count as separate lines too: only the selected ones go into the code block, and the lines
 * before and after stay where they were.
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
  if (blocks.length > 1 && !siblings) return editor.chain().focus().toggleCodeBlock().run()

  const codeBlock = state.schema.nodes.codeBlock
  if (!codeBlock) return false
  const first = blocks[0]
  const last = blocks[blocks.length - 1]
  // Offsets (inside the first / last block) where the selected lines start and end.
  const cutStart = first.node.type === codeBlock ? 0 : lineStart(first.node, from - first.pos - 1, from < to)
  const cutEnd = last.node.type === codeBlock ? last.node.content.size : lineEnd(last.node, to - last.pos - 1, from < to)
  const before = cutStart > 0 ? first.node.copy(first.node.content.cut(0, cutStart - 1)) : null
  const after = cutEnd < last.node.content.size ? last.node.copy(last.node.content.cut(cutEnd + 1)) : null
  if (blocks.length === 1 && !before && !after && first.node.type !== codeBlock && !hasLineBreak(first.node)) {
    return editor.chain().focus().toggleCodeBlock().run()
  }
  if (blocks.length === 1 && first.node.type === codeBlock) return editor.chain().focus().toggleCodeBlock().run()

  const text = state.doc.textBetween(first.pos + 1 + cutStart, last.pos + 1 + cutEnd, '\n', '\n')
  const start = first.pos
  const end = last.pos + last.node.nodeSize
  const nodes = [before, codeBlock.create(null, text ? state.schema.text(text) : null), after].filter(n => n != null)

  const tr = state.tr.replaceWith(start, end, nodes)
  const codeStart = start + (before ? before.nodeSize : 0)
  tr.setSelection(TextSelection.create(tr.doc, codeStart + 1 + text.length))
  editor.view.dispatch(tr.scrollIntoView())
  editor.commands.focus()
  return true
}

const isLineBreak = (node: PMNode) => node.type.name === 'hardBreak'
const hasLineBreak = (block: PMNode) => {
  let found = false
  block.forEach(child => { if (isLineBreak(child)) found = true })
  return found
}

/** Where the line holding `offset` starts: just after the line break before it, or 0. */
function lineStart(block: PMNode, offset: number, ranged: boolean): number {
  let start = 0
  block.forEach((child, childOffset) => {
    if (!isLineBreak(child)) return
    // A selection that begins right at a line break starts on the next line.
    if (childOffset + 1 <= offset || (ranged && childOffset === offset)) start = childOffset + 1
  })
  return start
}

/** Where the line holding `offset` ends: at the line break after it, or the end of the block. */
function lineEnd(block: PMNode, offset: number, ranged: boolean): number {
  let end = block.content.size
  block.forEach((child, childOffset) => {
    if (!isLineBreak(child) || end !== block.content.size) return
    // A selection that ends right after a line break stops on the line before it.
    if (childOffset >= offset || (ranged && childOffset + 1 === offset)) end = childOffset
  })
  return end
}
