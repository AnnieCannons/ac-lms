import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PrintModal from '@/components/flashcards/PrintModal'
import type { Card } from '@/lib/flashcards/schema'

describe('PrintModal', () => {
  it('escapes the deck title and cloze answer written into the print window', () => {
    const write = vi.fn()
    const fakeWin = { document: { write, close: vi.fn() }, focus: vi.fn(), print: vi.fn(), addEventListener: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(fakeWin as never)

    const payload = '<img src=x onerror=alert(1)>'
    const cards = [{
      id: 'c1', card_type: 'cloze', blank_index: 0, back_content: '',
      front_content: `Hello <span data-type="cloze-blank" data-word="${payload}">x</span>`,
    }] as unknown as Card[]

    render(<PrintModal cards={cards} deckTitle={payload} />)
    fireEvent.click(screen.getByRole('button', { name: 'Print' }))

    const html = write.mock.calls[0][0] as string
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })
})
