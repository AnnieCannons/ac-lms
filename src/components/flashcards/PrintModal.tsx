'use client'
import { useState } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import type { Card } from '@/lib/flashcards/schema'

type PrintMode = 'cutout' | 'table'

const PRINT_STYLES = `
  body { font-family: sans-serif; color: #000; background: #fff; margin: 0; padding: 12pt; box-sizing: border-box; }
  pre {
    font-family: monospace; font-size: 9pt; border: 1pt solid #ccc; border-left: 3pt solid #666;
    padding: 6pt 8pt; margin: 4pt 0; white-space: pre-wrap; word-break: break-word;
    break-inside: avoid; background: #f8f8f8; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  code { font-family: monospace; font-size: 9pt; background: #f0f0f0; padding: 1pt 3pt; border-radius: 2pt; }
  pre code { background: none; padding: 0; }

  /* Table layout */
  .table-layout { width: 100%; border-collapse: collapse; font-size: 11pt; }
  .table-layout th { background: #f0f0f0; padding: 6pt 10pt; text-align: left; border: 1pt solid #999; font-weight: 600; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .table-layout td { padding: 6pt 10pt; border: 1pt solid #ccc; vertical-align: top; }
  .table-layout tr { break-inside: avoid; }
  .table-layout tr:nth-child(even) td { background: #f9f9f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* Cut-out layout */
  .cutout-header { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 2pt solid #000; padding: 4pt 12pt; font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .card-row { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1.5pt dashed #999; break-inside: avoid; }
  .card-front { padding: 10pt 12pt; border-right: 1.5pt solid #999; font-size: 10pt; }
  .card-back { padding: 10pt 12pt; font-size: 10pt; color: #333; }
  .card-label { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 4pt; }

  .deck-header { margin-bottom: 12pt; border-bottom: 2pt solid #000; padding-bottom: 6pt; }
  .deck-header strong { font-size: 14pt; }
  .deck-header span { font-size: 9pt; margin-left: 8pt; color: #666; }
`

function buildHtml(mode: PrintMode, deckTitle: string, cards: Card[]): string {
  const header = `<div class="deck-header"><strong>${deckTitle}</strong><span>${cards.length} cards</span></div>`

  if (mode === 'table') {
    const rows = cards.map(c => `
      <tr>
        <td>${DOMPurify.sanitize(c.front_content)}</td>
        <td>${DOMPurify.sanitize(c.back_content)}</td>
      </tr>`).join('')
    return `${header}<table class="table-layout"><thead><tr><th style="width:50%">Front</th><th style="width:50%">Back</th></tr></thead><tbody>${rows}</tbody></table>`
  }

  const rows = cards.map(c => `
    <div class="card-row">
      <div class="card-front"><div class="card-label">Front</div>${DOMPurify.sanitize(c.front_content)}</div>
      <div class="card-back"><div class="card-label">Back</div>${DOMPurify.sanitize(c.back_content)}</div>
    </div>`).join('')
  return `${header}<p style="font-size:9pt;color:#555;margin-bottom:8pt;">Cut along the dashed lines. Fold each strip down the middle (vertical solid line) to make a card.</p><div class="cutout-header"><span>Front</span><span>Back</span></div>${rows}`
}

export default function PrintModal({ cards, deckTitle }: { cards: Card[]; deckTitle: string }) {
  const [open, setOpen] = useState(false)

  const handlePrint = (mode: PrintMode) => {
    setOpen(false)
    const printCards = cards.filter(c => c.card_type !== 'image_occlusion')
    const body = buildHtml(mode, deckTitle, printCards)
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${deckTitle}</title><style>${PRINT_STYLES}</style></head><body>${body}</body></html>`)
    win.document.close()
    win.focus()
    win.print()
    win.addEventListener('afterprint', () => win.close())
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted-text border border-border px-3 py-1.5 rounded-lg hover:text-teal-primary hover:border-teal-primary transition-colors"
      >
        Print
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-surface rounded-2xl p-6 w-80 flex flex-col gap-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-dark-text">Print Format</h3>
            <button
              onClick={() => handlePrint('table')}
              className="w-full text-left rounded-xl border border-border p-4 hover:border-teal-primary hover:bg-teal-light transition-colors"
            >
              <p className="text-sm font-medium text-dark-text mb-1">Study Sheet</p>
              <p className="text-xs text-muted-text">Two-column table — front and back side by side. Cover one column to quiz yourself.</p>
            </button>
            <button
              onClick={() => handlePrint('cutout')}
              className="w-full text-left rounded-xl border border-border p-4 hover:border-teal-primary hover:bg-teal-light transition-colors"
            >
              <p className="text-sm font-medium text-dark-text mb-1">Cut-out Cards</p>
              <p className="text-xs text-muted-text">Front and back in two columns with a fold line. Cut each row, fold in half to make physical flashcards.</p>
            </button>
            <button onClick={() => setOpen(false)} className="text-xs text-muted-text hover:text-dark-text transition-colors self-center">
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
