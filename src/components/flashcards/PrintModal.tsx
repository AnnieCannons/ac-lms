'use client'
import DOMPurify from 'isomorphic-dompurify'
import type { Card } from '@/lib/flashcards/schema'

const PRINT_STYLES = `
  body { font-family: sans-serif; color: #000; background: #fff; margin: 0; padding: 12pt; box-sizing: border-box; }
  pre {
    font-family: monospace; font-size: 9pt; border: 1pt solid #ccc; border-left: 3pt solid #666;
    padding: 6pt 8pt; margin: 4pt 0; white-space: pre-wrap; word-break: break-word;
    break-inside: avoid; background: #f8f8f8; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  code { font-family: monospace; font-size: 9pt; background: #f0f0f0; padding: 1pt 3pt; border-radius: 2pt; }
  pre code { background: none; padding: 0; }
  .deck-header { margin-bottom: 12pt; border-bottom: 2pt solid #000; padding-bottom: 6pt; }
  .deck-header strong { font-size: 14pt; }
  .deck-header span { font-size: 9pt; margin-left: 8pt; color: #666; }
  .cutout-header { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 2pt solid #000; padding: 4pt 12pt; font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .card-row { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1.5pt dashed #999; break-inside: avoid; }
  .card-front { padding: 10pt 12pt; border-right: 1.5pt solid #999; font-size: 10pt; }
  .card-back { padding: 10pt 12pt; font-size: 10pt; color: #333; }
  .card-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 4pt; }
`

export default function PrintModal({ cards, deckTitle }: { cards: Card[]; deckTitle: string }) {
  const handlePrint = () => {
    const printCards = cards.filter(c => c.card_type !== 'image_occlusion')
    const header = `<div class="deck-header"><strong>${deckTitle}</strong><span>${printCards.length} cards</span></div>`
    const instructions = `<p style="font-size:9pt;color:#555;margin-bottom:8pt;">Cut along the dashed lines. Fold each strip down the middle (vertical solid line) to make a card.</p>`
    const colHeader = `<div class="cutout-header"><span>Front</span><span>Back</span></div>`
    const rows = printCards.map(c => `
      <div class="card-row">
        <div class="card-front"><div class="card-label">Front</div>${DOMPurify.sanitize(c.front_content)}</div>
        <div class="card-back"><div class="card-label">Back</div>${DOMPurify.sanitize(c.back_content)}</div>
      </div>`).join('')
    const body = `${header}${instructions}${colHeader}${rows}`
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${deckTitle}</title><style>${PRINT_STYLES}</style></head><body>${body}</body></html>`)
    win.document.close()
    win.focus()
    win.print()
    win.addEventListener('afterprint', () => win.close())
  }

  return (
    <button
      onClick={handlePrint}
      className="text-xs text-muted-text border border-border px-3 py-1.5 rounded-lg hover:text-teal-primary hover:border-teal-primary transition-colors"
    >
      Print
    </button>
  )
}
