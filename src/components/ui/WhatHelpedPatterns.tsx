'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { computeWhatHelpedPatterns, type PatternMethod } from '@/lib/confidence-patterns'
import type { SkillTrend } from '@/lib/confidence-trend'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// Where there's no layout to measure (first paint, tests), show this many skills before "+N more".
const FALLBACK_INLINE_SKILLS = 3
// Space between tags (Tailwind gap-1.5), needed to work out how many fit on one line.
const GAP_PX = 6

const PILL_CLASS = 'rounded-full border border-teal-primary px-2.5 py-0.5 text-xs font-medium text-teal-primary'
const CHIP_CLASS = 'inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-muted-text'

// One skill as a small tag: the name, then how many times the method helped on it. The sr-only
// colon keeps "React 6" from reading as a bare pair of words to a screen reader.
function SkillChip({ skill }: { skill: PatternMethod['skills'][number] }) {
  return (
    <li className={CHIP_CLASS}>
      <span className="break-words">{skill.name}</span>
      <span className="sr-only">: </span>
      <b className="font-semibold text-dark-text">{skill.count}</b>
    </li>
  )
}

// How many of the skills fit on one line next to a "+N more" tag. Needs the real widths, so it
// reads them from a hidden copy of the row; returns null until there is a layout to read.
function countThatFit(container: HTMLElement, measure: HTMLElement): number | null {
  const available = container.clientWidth
  const items = Array.from(measure.children) as HTMLElement[]
  if (available === 0 || items.length < 2) return null
  const pill = items[items.length - 1].offsetWidth
  const chips = items.slice(0, -1).map(el => el.offsetWidth)
  const all = chips.reduce((sum, w) => sum + w, 0) + GAP_PX * (chips.length - 1)
  if (all <= available) return chips.length

  let used = 0
  let fit = 0
  for (const w of chips) {
    // Each chip placed, plus the gap and the pill that must still follow it.
    if (used + w + GAP_PX + pill > available) break
    used += w + GAP_PX
    fit += 1
  }
  return Math.max(fit, 1)
}

// One method's skills as tags. Collapsed, it is a single line: as many skills as fit, then a "+N more"
// tag as the last item. Opened, every skill wraps and the tag becomes "Show fewer".
function MethodSkills({ method }: { method: PatternMethod }) {
  const [open, setOpen] = useState(false)
  const [fit, setFit] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const total = method.skills.length

  useLayoutEffect(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return
    const update = () => setFit(countThatFit(container, measure))
    update()
    if (typeof ResizeObserver === 'undefined') return
    // Re-measure when the window is resized or a font finishes loading and changes the widths.
    const observer = new ResizeObserver(update)
    observer.observe(container)
    observer.observe(measure)
    return () => observer.disconnect()
  }, [method.skills])

  const shown = open ? total : Math.min(fit ?? FALLBACK_INLINE_SKILLS, total)
  const hidden = total - shown

  return (
    <div ref={containerRef} className="relative mt-2">
      <ul
        aria-label={`Skills ${method.label} helped on`}
        className={`flex items-center gap-1.5 ${open ? 'flex-wrap' : 'flex-nowrap overflow-hidden'}`}
      >
        {method.skills.slice(0, shown).map(s => <SkillChip key={s.skillId} skill={s} />)}
        {(hidden > 0 || open) && (
          <li className="shrink-0">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen(o => !o)}
              className={`${PILL_CLASS} hover:bg-teal-light transition-colors`}
            >
              {open ? 'Show fewer' : `+${hidden} more`}
            </button>
          </li>
        )}
      </ul>
      {/* Hidden copy of the row, only to read each tag's width: every skill, then the widest "+N more".
          The outer box is zero-height and clips, so a long row can't widen the page. */}
      <div aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 h-0 w-full overflow-hidden">
        <div ref={measureRef} className="flex w-max flex-nowrap gap-1.5 whitespace-nowrap">
          {method.skills.map(s => (
            <span key={s.skillId} className={CHIP_CLASS}>
              <span>{s.name}</span>
              <b className="font-semibold">{s.count}</b>
            </span>
          ))}
          <span className={`${PILL_CLASS} shrink-0`}>{`+${total} more`}</span>
        </div>
      </div>
    </div>
  )
}

// The student's own "what helped" answers gathered by method, with the skills each helped on.
// Descriptive only: no averages, rankings or comparisons, and nothing here writes data.
export default function WhatHelpedPatterns({ trends }: { trends: SkillTrend[] }) {
  const { answeredGoals, methods } = computeWhatHelpedPatterns(trends)

  return (
    <section id="patterns" aria-labelledby="patterns-heading" className="space-y-4 scroll-mt-6">
      {/* Title and description sit together with the same tight gap as the Skills tab's sections. */}
      <div>
        <h2 id="patterns-heading" className="text-lg font-bold text-dark-text">What tends to help you</h2>
        <p className="mt-1 text-sm text-muted-text">
          These come from your own answers to &ldquo;What helped?&rdquo;. They show what tends to go along with your progress, not proof that a method caused it, and everyone is different.
        </p>
      </div>

      {methods.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-dark-text">
          Patterns will show up here as you reach goals and log what helped.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-sm text-muted-text">
              The following is based on {plural(answeredGoals, 'time')} where you logged what helped.
            </p>
            <p className="text-xs text-muted-text">
              Note: you can pick more than one method for a goal, so these counts won&apos;t add up to your total.
            </p>
          </div>
          <ul className="space-y-2">
            {methods.map(m => (
              <li key={m.value} className="flex gap-3 rounded-xl border border-border bg-surface px-4 py-3">
                {/* The text beside it carries the count; the tile is decoration. */}
                <div aria-hidden="true" className="flex h-11 min-w-11 items-center justify-center rounded-lg bg-teal-light px-2 text-xl font-semibold text-teal-primary">
                  {m.count}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-dark-text">{m.label}</p>
                  <p className="text-sm text-muted-text">Helped {plural(m.count, 'time')}</p>
                  <MethodSkills method={m} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
