import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/react'

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/upload-file', () => ({ uploadFile: vi.fn() }))

import RichTextEditor from '@/components/ui/RichTextEditor'

async function mount(props: Partial<React.ComponentProps<typeof RichTextEditor>> = {}) {
  const onChange = vi.fn()
  const { container } = render(<RichTextEditor content="" onChange={onChange} {...props} />)
  const dom = await waitFor(() => {
    const el = container.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null
    if (!el?.editor) throw new Error('editor not ready')
    return el
  })
  return { editor: dom.editor!, onChange }
}

const PASTE = 'Q1\nA1\n\nQ2\nA2'

describe('RichTextEditor paste', () => {
  it('keeps blank lines in pasted plain text when keepBlankLines is set', async () => {
    const { editor } = await mount({ keepBlankLines: true })
    editor.view.pasteText(PASTE, new Event('paste') as ClipboardEvent)
    expect(editor.getHTML()).toBe('<p>Q1</p><p>A1</p><p></p><p>Q2</p><p>A2</p>')
  })

  it('collapses blank lines by default (unchanged elsewhere)', async () => {
    const { editor } = await mount()
    editor.view.pasteText(PASTE, new Event('paste') as ClipboardEvent)
    expect(editor.getHTML()).not.toContain('<p></p>')
  })

  it('labels the inline code button with the word code', async () => {
    await mount()
    expect(screen.getByRole('button', { name: 'Inline code' }).textContent).toBe('`code`')
    expect(screen.getByRole('button', { name: 'Code block' }).textContent).toBe('</>')
  })
})
