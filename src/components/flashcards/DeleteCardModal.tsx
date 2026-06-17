'use client'
import { useEffect, useRef } from 'react'

type Props = {
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteCardModal({ onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { cancelRef.current?.focus() }, [])

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
        className="bg-surface rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h2 id="delete-card-modal-title" className="text-base font-semibold text-dark-text">
            Delete card?
          </h2>
          <p className="text-sm text-muted-text mt-1">
            This card and its progress will be permanently deleted. This cannot be undone.
          </p>
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
