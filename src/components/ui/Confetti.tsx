'use client'
import { useEffect, useMemo, useState } from 'react'

const COLORS = ['#6D2B5E', '#c870b0', '#7B3FB0', '#F2B33D', '#2BA59B', '#E8604C', '#4C8BE8']
const DURATION_MS = 4200

// Small seeded random (mulberry32), so each burst's layout is pure for a given burst number.
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A one-off burst of falling confetti over the whole page. Decorative only (aria-hidden,
 * no pointer events) and hidden for reduced motion via the .confetti-piece CSS.
 * Increase `burst` to fire it again; 0 shows nothing.
 */
export default function Confetti({ burst, pieces = 120 }: { burst: number; pieces?: number }) {
  const [doneBurst, setDoneBurst] = useState(0)

  useEffect(() => {
    if (burst === 0) return
    const t = setTimeout(() => setDoneBurst(burst), DURATION_MS)
    return () => clearTimeout(t)
  }, [burst])

  const shapes = useMemo(() => {
    const rand = seeded(burst * 7919 + 17)
    return Array.from({ length: pieces }, (_, i) => {
      const size = 6 + rand() * 8
      return {
        key: `${burst}-${i}`,
        left: rand() * 100,
        width: size,
        height: rand() < 0.5 ? size : size * 0.4,
        round: rand() < 0.25,
        color: COLORS[i % COLORS.length],
        delay: rand() * 600,
        duration: 2200 + rand() * 1600,
        drift: (rand() - 0.5) * 240,
        spin: (rand() < 0.5 ? -1 : 1) * (360 + rand() * 720),
      }
    })
  }, [burst, pieces])

  if (burst === 0 || doneBurst === burst) return null

  return (
    <div aria-hidden="true" data-testid="confetti" className="fixed inset-0 pointer-events-none overflow-hidden z-[100]">
      {shapes.map(s => (
        <span
          key={s.key}
          className="confetti-piece"
          style={{
            left: `${s.left}%`,
            width: s.width,
            height: s.height,
            backgroundColor: s.color,
            borderRadius: s.round ? '9999px' : '2px',
            animationDelay: `${s.delay}ms`,
            animationDuration: `${s.duration}ms`,
            ['--confetti-drift' as string]: `${s.drift}px`,
            ['--confetti-spin' as string]: `${s.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}
