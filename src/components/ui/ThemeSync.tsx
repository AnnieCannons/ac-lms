'use client'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function ThemeSync() {
  const pathname = usePathname()
  useEffect(() => {
    try {
      const root = document.documentElement
      if (localStorage.getItem('dark-mode') === 'true') {
        root.classList.add('theme-dark')
      } else {
        root.classList.remove('theme-dark')
      }
      if (localStorage.getItem('dyslexic-font') === 'true') {
        root.classList.add('dyslexic')
      }
      if (localStorage.getItem('high-contrast') === 'true') {
        root.classList.add('high-contrast')
      }
    } catch {}
  }, [pathname])
  return null
}
