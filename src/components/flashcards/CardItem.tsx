'use client'
import { useState } from 'react'
import Link from 'next/link'
import DOMPurify from 'isomorphic-dompurify'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DeleteCardModal from './DeleteCardModal'
import type { Card } from '@/lib/flashcards/seed'

const TYPE_LABELS: Record<string, string> = {
  basic: 'Basic',
  type_in: 'Type In',
  cloze: 'Cloze',
  image_occlusion: 'Image Occlusion',
}

function sanitize(html: string): string {
  return DOMPurify.sanitize(html)
}

type Props = {
  card: Card
  deckId: string
  onDelete: (cardId: string) => void
}

export default function CardItem({ card, deckId, onDelete }: Props) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const frontPreview = sanitize(card.front_content)
  const backPreview = sanitize(card.back_content)

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="bg-surface border border-border rounded-xl p-4 flex gap-3 items-start group hover:border-teal-primary transition-colors"
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 text-border hover:text-muted-text cursor-grab active:cursor-grabbing touch-none"
          aria-label="Drag to reorder"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
          </svg>
        </button>

        {/* Card content */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium bg-teal-light text-teal-primary px-2 py-0.5 rounded-md">
              {TYPE_LABELS[card.card_type] ?? card.card_type}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <div>
              <p className="text-[10px] font-semibold text-muted-text uppercase tracking-widest mb-0.5">Front</p>
              <div
                className="text-xs text-dark-text max-h-32 overflow-y-auto prose prose-xs [&_code]:bg-border/40 [&_code]:text-dark-text [&_code]:px-1 [&_code]:rounded [&_code]:text-[11px] [&_pre]:bg-border/30 [&_pre]:overflow-x-auto [&_pre]:w-full [&_pre_code]:bg-transparent [&_ul]:pl-3 [&_ol]:pl-3 [&_li]:my-0 [&_blockquote]:border-l-2 [&_blockquote]:border-teal-primary [&_blockquote]:pl-3 [&_blockquote]:text-dark-text [&_blockquote]:not-italic"
                dangerouslySetInnerHTML={{ __html: frontPreview || '<span class="text-muted-text">(empty)</span>' }}
              />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-text uppercase tracking-widest mb-0.5">Back</p>
              <div
                className="text-xs text-dark-text max-h-32 overflow-y-auto prose prose-xs [&_code]:bg-border/40 [&_code]:text-dark-text [&_code]:px-1 [&_code]:rounded [&_code]:text-[11px] [&_pre]:bg-border/30 [&_pre]:overflow-x-auto [&_pre]:w-full [&_pre_code]:bg-transparent [&_ul]:pl-3 [&_ol]:pl-3 [&_li]:my-0 [&_blockquote]:border-l-2 [&_blockquote]:border-teal-primary [&_blockquote]:pl-3 [&_blockquote]:text-dark-text [&_blockquote]:not-italic"
                dangerouslySetInnerHTML={{ __html: backPreview || '<span class="text-muted-text">(empty)</span>' }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative group/tip">
            <Link
              href={`/flashcards/decks/${deckId}/cards/${card.id}/edit`}
              className="w-7 h-7 flex items-center justify-center border border-border rounded-lg text-muted-text hover:text-teal-primary hover:border-teal-primary transition-colors"
              aria-label="Edit card"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </Link>
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-white opacity-0 group-hover/tip:opacity-100 transition-opacity">
              Edit
            </span>
          </div>
          <div className="relative group/tip">
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-7 h-7 flex items-center justify-center border border-border rounded-lg text-muted-text hover:text-red-500 hover:border-red-300 transition-colors"
              aria-label="Delete card"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-white opacity-0 group-hover/tip:opacity-100 transition-opacity">
              Delete
            </span>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteCardModal
          onConfirm={() => { onDelete(card.id); setShowDeleteModal(false) }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </>
  )
}
