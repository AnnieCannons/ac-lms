'use client'
import { useState, useEffect } from 'react'

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

function applyDark(on: boolean, highContrast = false) {
  const root = document.documentElement
  if (on) {
    const vars = highContrast ? DARK_HC_VARS : DARK_VARS
    root.classList.add('theme-dark')
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
    document.body.style.setProperty('background-color', highContrast ? '#050308' : '#120d1e', 'important')
    document.body.style.setProperty('color', highContrast ? '#ffffff' : '#f0eaf8', 'important')
  } else {
    root.classList.remove('theme-dark')
    Object.keys(DARK_VARS).forEach(k => root.style.removeProperty(k))
    document.body.style.removeProperty('background-color')
    document.body.style.removeProperty('color')
  }
}

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-6 ${disabled ? 'opacity-40' : ''}`}>
      <div>
        <label htmlFor={id} className={`text-sm font-medium text-dark-text ${disabled ? '' : 'cursor-pointer'}`}>
          {label}
        </label>
        <p className="text-xs text-muted-text mt-0.5">{description}</p>
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={disabled ? undefined : onChange}
        disabled={disabled}
        aria-disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-primary focus-visible:ring-offset-2 ${
          disabled ? 'cursor-not-allowed bg-border' : checked ? 'bg-teal-primary' : 'bg-border'
        }`}
      >
        <span className="sr-only">{label}</span>
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform mt-1 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

export default function AccessibilitySettings() {
  const [dyslexic, setDyslexic] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [highContrast, setHighContrast] = useState(false)

  useEffect(() => {
    setDyslexic(document.documentElement.classList.contains('dyslexic'))
    setDarkMode(localStorage.getItem('dark-mode') === 'true')
    setHighContrast(document.documentElement.classList.contains('high-contrast'))
  }, [])

  const toggleDyslexic = () => {
    const next = !dyslexic
    setDyslexic(next)
    document.documentElement.classList.toggle('dyslexic', next)
    try { localStorage.setItem('dyslexic-font', String(next)) } catch {}
  }

  const toggleDarkMode = () => {
    const next = !darkMode
    setDarkMode(next)
    applyDark(next, highContrast)
    try { localStorage.setItem('dark-mode', String(next)) } catch {}
  }

  const toggleHighContrast = () => {
    const next = !highContrast
    setHighContrast(next)
    document.documentElement.classList.toggle('high-contrast', next)
    if (darkMode) applyDark(true, next)
    try { localStorage.setItem('high-contrast', String(next)) } catch {}
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-6">
      <h2 className="text-base font-semibold text-dark-text mb-5">Accessibility</h2>
      <div className="flex flex-col gap-5">
        <Toggle
          id="dyslexic-toggle"
          label="Dyslexia-friendly font"
          description="Switches to OpenDyslexic, a font designed to improve readability for people with dyslexia."
          checked={dyslexic}
          onChange={toggleDyslexic}
        />
        <div className="border-t border-border" />
        <Toggle
          id="dark-mode-toggle"
          label="Dark mode"
          description="Switches to a dark color scheme to reduce eye strain in low-light environments."
          checked={darkMode}
          onChange={toggleDarkMode}
        />
        <div className="border-t border-border" />
        <Toggle
          id="high-contrast-toggle"
          label="High contrast"
          description="Maximizes contrast throughout the site for easier reading."
          checked={highContrast}
          onChange={toggleHighContrast}
        />
      </div>
    </div>
  )
}
