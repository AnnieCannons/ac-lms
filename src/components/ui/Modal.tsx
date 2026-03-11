'use client'
import { useRef, useEffect, useId } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export default function Modal({ title, onClose, children, maxWidth = 'max-w-sm' }: {
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const mouseDownOnBackdrop = useRef(false)
  const titleId = useId()
  useFocusTrap(dialogRef, onClose)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    return () => prev?.focus()
  }, [])
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={backdropRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onMouseDown={e => { mouseDownOnBackdrop.current = e.target === backdropRef.current }}
        onMouseUp={e => { if (mouseDownOnBackdrop.current && e.target === backdropRef.current) onClose() }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`bg-surface rounded-2xl border border-border shadow-2xl w-full ${maxWidth} p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto`}
        >
          <div className="flex items-center justify-between">
            <h2 id={titleId} className="text-base font-bold text-dark-text">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="text-muted-text hover:text-dark-text text-xl leading-none">✕</button>
          </div>
          {children}
        </div>
      </div>
    </>
  )
}
