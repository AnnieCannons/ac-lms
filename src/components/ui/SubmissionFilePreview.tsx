'use client'
import { useState } from 'react'
import { normalizeUrl } from '@/lib/url'

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i

interface Props {
  content: string
}

export default function SubmissionFilePreview({ content }: Props) {
  const [open, setOpen] = useState(false)
  const isImage = IMAGE_RE.test(content)

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
        className="block focus:outline-none rounded-lg overflow-hidden border border-border hover:opacity-90 transition-opacity"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={content} alt="Submission" className="max-h-48 object-contain bg-background" />
      </button>
      <a href={normalizeUrl(content)} target="_blank" rel="noopener noreferrer"
        className="text-teal-primary underline break-all text-xs mt-1 block">
        {content}
      </a>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setOpen(false)}
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full w-9 h-9 flex items-center justify-center text-lg transition-colors"
            aria-label="Close"
          >
            ✕
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
