'use client'
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CodeBlock from '@tiptap/extension-code-block'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { useState, useRef } from 'react'
import { ClozeBlankExtension } from './ClozeBlankExtension'
import ClozeBlankView from './ClozeBlankView'

type Props = {
  content: string
  onChange: (html: string) => void
}

const ClozeBlankWithView = ClozeBlankExtension.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ClozeBlankView)
  },
})

export default function ClozeCardEditor({ content, onChange }: Props) {
  const [linkInputOpen, setLinkInputOpen] = useState(false)
  const [linkUrlDraft, setLinkUrlDraft] = useState('')
  const linkInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlock.extend({ content: '(text | clozeBlank)*' }),
      Placeholder.configure({ placeholder: 'Type a sentence, then highlight a word and click [ Blank ]…' }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: 'text-teal-primary underline cursor-pointer' },
      }),
      ClozeBlankWithView,
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = ed.getHTML()
      onChange(html === '<p></p>' ? '' : html)
    },
    editorProps: {
      attributes: {
        class: 'max-h-[800px] overflow-y-auto focus:outline-none text-sm text-dark-text bg-background leading-relaxed px-3 py-2 min-h-[120px]',
      },
    },
  })

  if (!editor) return null
  const ed = editor

  const hasSelection = !ed.state.selection.empty
  const hasStoredMark = (name: string) => !!(ed.state.storedMarks?.find(m => m.type.name === name))
  const isBold = ed.isActive('bold') || hasStoredMark('bold')
  const isItalic = ed.isActive('italic') || hasStoredMark('italic')
  const isLinkActive = ed.isActive('link')

  const btn = (active: boolean) =>
    `px-2 py-1 rounded text-xs font-medium transition-colors ${
      active ? 'bg-purple-primary text-white' : 'text-muted-text hover:bg-border/40 hover:text-dark-text'
    }`
  const tool = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); fn() }

  function handleBlankButton(e: React.MouseEvent) {
    e.preventDefault()
    const { from, to } = ed.state.selection
    if (from === to) return
    const word = ed.state.doc.textBetween(from, to)
    ed.chain().focus().deleteSelection().insertContent({ type: 'clozeBlank', attrs: { word } }).run()
  }

  function handleLinkButton(e: React.MouseEvent) {
    e.preventDefault()
    if (isLinkActive) { ed.chain().focus().unsetLink().run(); return }
    const { from, to } = ed.state.selection
    if (from === to) return
    setLinkUrlDraft('')
    setLinkInputOpen(true)
  }

  function applyLink() {
    const url = linkUrlDraft.trim()
    if (!url) { setLinkInputOpen(false); return }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
    ed.chain().focus().setLink({ href }).run()
    setLinkInputOpen(false)
    setLinkUrlDraft('')
  }

  const blankBtnClass = hasSelection
    ? 'px-2 py-1 rounded text-xs font-medium transition-colors border border-teal-primary text-teal-primary hover:bg-teal-light'
    : 'px-2 py-1 rounded text-xs font-medium text-border cursor-default'

  return (
    <div className="border border-border rounded-lg bg-background overflow-hidden focus-within:ring-2 focus-within:ring-teal-primary">
      <div role="toolbar" aria-label="Text formatting" className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-surface flex-wrap">
        {/* [ Blank ] button first */}
        <button
          type="button"
          onMouseDown={handleBlankButton}
          className={blankBtnClass}
          aria-label="Make selected text a blank"
          title={hasSelection ? 'Make selected text a blank' : 'Highlight a word first, then click Blank'}
        >
          [ Blank ]
        </button>
        <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-border mx-1" />
        <button type="button" onMouseDown={tool(() => ed.chain().focus().toggleBold().run())} className={btn(isBold)} aria-label="Bold" aria-pressed={isBold}>B</button>
        <button type="button" onMouseDown={tool(() => ed.chain().focus().toggleItalic().run())} className={`${btn(isItalic)} italic`} aria-label="Italic" aria-pressed={isItalic}>I</button>
        <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-border mx-1" />
        <button type="button" onMouseDown={tool(() => ed.chain().focus().toggleHeading({ level: 2 }).run())} className={btn(ed.isActive('heading', { level: 2 }))} aria-label="Heading 2">H2</button>
        <button type="button" onMouseDown={tool(() => ed.chain().focus().toggleHeading({ level: 3 }).run())} className={btn(ed.isActive('heading', { level: 3 }))} aria-label="Heading 3">H3</button>
        <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-border mx-1" />
        <button type="button" onMouseDown={tool(() => ed.chain().focus().toggleBulletList().run())} className={btn(ed.isActive('bulletList'))} aria-label="Bullet list">• List</button>
        <button type="button" onMouseDown={tool(() => ed.chain().focus().toggleOrderedList().run())} className={btn(ed.isActive('orderedList'))} aria-label="Numbered list">1. List</button>
        <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-border mx-1" />
        <button type="button" onMouseDown={tool(() => ed.chain().focus().toggleBlockquote().run())} className={btn(ed.isActive('blockquote'))} aria-label="Blockquote">&ldquo; Quote</button>
        <button type="button" onMouseDown={tool(() => ed.chain().focus().toggleCode().run())} className={`${btn(ed.isActive('code'))} font-mono`} aria-label="Inline code">`</button>
        <button type="button" onMouseDown={tool(() => ed.chain().focus().toggleCodeBlock().run())} className={`${btn(ed.isActive('codeBlock'))} font-mono`} aria-label="Code block">```</button>
        <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-border mx-1" />
        <button type="button" onMouseDown={handleLinkButton} className={btn(isLinkActive)} aria-label={isLinkActive ? 'Remove link' : 'Add link'} title={isLinkActive ? 'Remove link' : 'Add link (select text first)'}>
          🔗
        </button>
      </div>

      {linkInputOpen && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface">
          <input
            ref={linkInputRef}
            type="url"
            value={linkUrlDraft}
            onChange={e => setLinkUrlDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink() }
              if (e.key === 'Escape') setLinkInputOpen(false)
            }}
            placeholder="https://..."
            className="flex-1 text-xs border border-border rounded px-2 py-1 bg-background text-dark-text focus:outline-none focus:ring-1 focus:ring-teal-primary"
          />
          <button type="button" onMouseDown={e => { e.preventDefault(); applyLink() }} className="text-xs px-2 py-1 rounded bg-teal-primary text-white hover:opacity-80 transition-opacity">Add</button>
          <button type="button" onMouseDown={e => { e.preventDefault(); setLinkInputOpen(false) }} className="text-xs px-2 py-1 rounded text-muted-text hover:text-dark-text transition-colors">Cancel</button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}
