'use client'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const DARK_VARS: Record<string, string> = {
  '--color-background': '#120d1e',
  '--color-surface':    '#1e1530',
  '--color-dark-text':  '#f0eaf8',
  '--color-muted-text': '#a898c0',
  '--color-border':     '#2e2245',
  '--color-teal-primary':   '#c870b0',
  '--color-teal-light':     '#2a1530',
  '--color-purple-primary': '#b080e0',
  '--color-purple-light':   '#251540',
}

const DARK_HC_VARS: Record<string, string> = {
  '--color-background': '#050308',
  '--color-surface':    '#0f0820',
  '--color-dark-text':  '#ffffff',
  '--color-muted-text': '#e8deff',
  '--color-border':     '#887098',
  '--color-teal-primary':   '#ff90f0',
  '--color-teal-light':     '#1c0a34',
  '--color-purple-primary': '#d0aaff',
  '--color-purple-light':   '#1a0840',
}

export default function ThemeSync() {
  const pathname = usePathname()
  useEffect(() => {
    try {
      const root = document.documentElement
      const dark = localStorage.getItem('dark-mode') === 'true'
      const hc = localStorage.getItem('high-contrast') === 'true'

      if (dark) {
        const vars = hc ? DARK_HC_VARS : DARK_VARS
        root.classList.add('theme-dark')
        Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
        document.body.style.setProperty('background-color', hc ? '#050308' : '#120d1e', 'important')
        document.body.style.setProperty('color', hc ? '#ffffff' : '#f0eaf8', 'important')
      } else {
        root.classList.remove('theme-dark')
        Object.keys(DARK_VARS).forEach(k => root.style.removeProperty(k))
        document.body.style.removeProperty('background-color')
        document.body.style.removeProperty('color')
      }

      root.classList.toggle('dyslexic', localStorage.getItem('dyslexic-font') === 'true')
      root.classList.toggle('high-contrast', hc)
    } catch {}
  }, [pathname])
  return null
}
