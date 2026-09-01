'use client'
import { useEffect, useRef } from 'react'

type Props = {
  onConfirm: () => void
  onCancel: () => void
  groupCount?: number // for cloze cards — number of cards that will be deleted
}

export default function DeleteCardModal({ onConfirm, onCancel, groupCount }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => { cancelRef.current?.focus() }, [])

  // Focus trap
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const focusable = dialog.querySelectorAll<HTMLElement>('button')
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    dialog.addEventListener('keydown', trap)
    return () => dialog.removeEventListener('keydown', trap)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-card-modal-title"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        className="bg-surface rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h2 id="delete-card-modal-title" className="text-base font-semibold text-dark-text">
            {groupCount && groupCount > 1 ? `Delete all ${groupCount} cards in this group?` : 'Delete card?'}
          </h2>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Yes, delete
          </button>
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 border border-border text-sm font-medium text-dark-text py-2 rounded-lg hover:bg-border/20 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
