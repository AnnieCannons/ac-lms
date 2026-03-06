'use client'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function FocusResetter() {
  const pathname = usePathname()
  useEffect(() => {
    (document.getElementById('main-content') as HTMLElement | null)?.focus()
  }, [pathname])
  return null
}
