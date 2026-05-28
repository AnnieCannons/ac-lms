'use client'

import { useEffect } from 'react'

interface Props {
  name: string
  embedUrl: string
  onClose: () => void
}

export default function FormEmbedModal({ name, embedUrl, onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative flex flex-col w-full max-w-3xl h-[85vh] bg-surface rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="text-base font-semibold text-dark-text">{name}</p>
          <button
            onClick={onClose}
            className="text-muted-text hover:text-dark-text transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {embedUrl.startsWith('PLACEHOLDER') ? (
          <div className="flex flex-1 items-center justify-center text-muted-text text-sm">
            Embed URL not yet configured for this form.
          </div>
        ) : (
          <iframe
            src={embedUrl}
            className="flex-1 w-full border-0"
            title={name}
            allow="camera; microphone"
          />
        )}
      </div>
    </div>
  )
}
