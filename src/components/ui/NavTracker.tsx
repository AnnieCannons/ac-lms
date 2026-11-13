'use client'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { recordNavigation } from '@/lib/nav-trail'

export default function NavTracker() {
  const pathname = usePathname()
  useEffect(() => { recordNavigation(pathname) }, [pathname])
  return null
}
