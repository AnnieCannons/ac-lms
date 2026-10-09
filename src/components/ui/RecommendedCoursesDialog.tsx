'use client'
import { useRef } from 'react'
import type { LevelUpLink } from '@/lib/level-up-links'

/**
 * "N recommended courses" button on a Level Up platform card, opening the list in a modal
 * so the cards themselves never change size. Uses the native <dialog>: Escape closes it,
 * focus stays inside while open and returns to the button afterwards.
 */
export default function RecommendedCoursesDialog({ platformName, links }: { platformName: string; links: LevelUpLink[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = `recommended-${platformName.replace(/\W+/g, '-').toLowerCase()}`
  const close = () => dialogRef.current?.close()

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
        className="self-start text-sm font-semibold text-dark-text hover:text-teal-primary underline decoration-dotted underline-offset-4"
      >
        {links.length} recommended course{links.length === 1 ? '' : 's'}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        // A click on the backdrop lands on the <dialog> itself, not its content
        onClick={e => { if (e.target === e.currentTarget) close() }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-border bg-surface text-dark-text p-0 backdrop:bg-black/60"
      >
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <h3 id={titleId} className="font-semibold text-dark-text">Recommended on {platformName}</h3>
            <button type="button" onClick={close} aria-label="Close" className="text-muted-text hover:text-dark-text text-lg leading-none -mt-1">
              ✕
            </button>
          </div>
          <ul className="flex flex-col gap-3">
            {links.map(l => (
              <li key={l.id}>
                {/* Close on open so the list isn't still covering the page when they come back to this tab */}
                <a href={l.url} target="_blank" rel="noopener noreferrer" onClick={close} className="font-medium text-teal-primary hover:underline">
                  {l.title} ↗<span className="sr-only"> (opens in a new tab)</span>
                </a>
                {l.description && <p className="text-sm text-muted-text mt-0.5">{l.description}</p>}
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  )
}
