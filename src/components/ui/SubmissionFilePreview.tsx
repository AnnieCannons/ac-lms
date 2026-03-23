'use client'
import { useState, useEffect, useRef } from 'react'
import { normalizeUrl } from '@/lib/url'

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i

interface Props {
  content: string
}

export default function SubmissionFilePreview({ content }: Props) {
  const [open, setOpen] = useState(false)
  const isImage = IMAGE_RE.test(content)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeBtnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!isImage) {
    return (
      <a href={normalizeUrl(content)} target="_blank" rel="noopener noreferrer"
        className="text-teal-primary underline break-all text-sm">
        {content}
      </a>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="View submission image fullscreen"
        className="block rounded-lg overflow-hidden border border-border hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-teal-primary focus-visible:outline-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={content} alt="Submission" className="max-h-48 object-contain bg-background" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Submission image fullscreen view"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setOpen(false)}
        >
          <button
            ref={closeBtnRef}
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full w-9 h-9 flex items-center justify-center text-lg transition-colors"
            aria-label="Close fullscreen view"
          >
            <span aria-hidden="true">✕</span>
          </button>
          <div onClick={e => e.stopPropagation()} className="max-w-[90vw] max-h-[90vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={content} alt="Submission" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </>
  )
}
