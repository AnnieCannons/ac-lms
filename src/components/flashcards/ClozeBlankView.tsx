'use client'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

export default function ClozeBlankView({ node, getPos, editor }: NodeViewProps) {
  function unblank(e: React.MouseEvent) {
    e.preventDefault()
    const pos = typeof getPos === 'function' ? getPos() : null
    if (pos == null) return
    editor.chain().focus().insertContentAt({ from: pos, to: pos + 1 }, node.attrs.word).run()
  }

  return (
    <NodeViewWrapper as="span" style={{ display: 'inline' }}>
      <span className="inline-flex items-center gap-0.5 px-1 bg-teal-light border-b-2 border-teal-primary text-teal-primary font-medium select-none">
        {node.attrs.word}
        <button
          type="button"
          onMouseDown={unblank}
          className="ml-0.5 text-teal-primary hover:text-red-500 transition-colors leading-none text-base"
          aria-label={`Remove blank for "${node.attrs.word}"`}
        >
          ×
        </button>
      </span>
    </NodeViewWrapper>
  )
}
