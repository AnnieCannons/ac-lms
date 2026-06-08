'use client'

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { PartnerDepartment } from '@/lib/partner-constants'
import { DEPARTMENT_LABELS } from '@/lib/partner-constants'

const DEPT_DOT: Record<PartnerDepartment, string> = {
  student_success: 'bg-purple-400',
  career_development: 'bg-teal-400',
  resourcefull: 'bg-blue-400',
  funding_partnerships: 'bg-green-400',
  admissions: 'bg-orange-400',
}

const DEPT_COLORS: Record<PartnerDepartment, string> = {
  student_success: 'text-purple-700',
  career_development: 'text-teal-700',
  resourcefull: 'text-blue-700',
  funding_partnerships: 'text-green-700',
  admissions: 'text-orange-700',
}

const ALL_DEPARTMENTS = Object.keys(DEPARTMENT_LABELS) as PartnerDepartment[]

const MIN_WIDTH = 160
const MAX_WIDTH = 360
const DEFAULT_WIDTH = 220
const COLLAPSED_WIDTH = 48

interface Props {
  deptCounts: Record<PartnerDepartment, number>
  totalCount: number
}

export default function PartnershipsSidebar({ deptCounts, totalCount }: Props) {
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [collapsed, setCollapsed] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [deptParam, setDeptParam] = useState<string | null>(null)
  const widthRef = useRef(DEFAULT_WIDTH)
  const startXRef = useRef(0)
  const startWidthRef = useRef(DEFAULT_WIDTH)
  widthRef.current = width
  const pathname = usePathname()

  // Read dept search param client-side for active highlighting
  useEffect(() => {
    setDeptParam(new URLSearchParams(window.location.search).get('dept'))
  }, [pathname])

  useLayoutEffect(() => {
    try {
      const w = localStorage.getItem('partnerships-sidebar-width')
      const c = localStorage.getItem('partnerships-sidebar-collapsed')
      if (w) { const n = parseInt(w); setWidth(n); widthRef.current = n }
      if (c === 'true') setCollapsed(true)
      else if (c === null && window.innerWidth < 768) setCollapsed(true)
    } catch {}
  }, [])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('partnerships-sidebar-collapsed', String(next)) } catch {}
  }

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startXRef.current = e.clientX
    startWidthRef.current = widthRef.current
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidthRef.current + e.clientX - startXRef.current))
      setWidth(newWidth)
      widthRef.current = newWidth
    }
    const handleMouseUp = () => {
      setIsResizing(false)
      try { localStorage.setItem('partnerships-sidebar-width', String(widthRef.current)) } catch {}
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const isActive = (href: string) => {
    if (href === '/instructor/partnerships') return pathname === '/instructor/partnerships'
    return pathname.startsWith(href)
  }

  const isDeptActive = (dept: PartnerDepartment) =>
    pathname === '/instructor/partnerships/all' && deptParam === dept

  const linkClass = (href: string) =>
    `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
      isActive(href)
        ? 'bg-teal-light text-teal-primary font-medium'
        : 'text-muted-text hover:text-dark-text hover:bg-background'
    }`

  const currentWidth = collapsed ? COLLAPSED_WIDTH : width

  return (
    <aside
      className="sticky top-[65px] self-start shrink-0 h-[calc(100vh-65px)] flex flex-col relative"
      style={{ width: currentWidth }}
    >
      {/* Toggle button */}
      <div className="flex items-center justify-end px-2 pt-3 pb-1 shrink-0">
        <button
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-md text-muted-text hover:text-dark-text hover:bg-background transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Nav content */}
      <div
        className="flex flex-col gap-1 px-2 py-2 overflow-y-auto overflow-x-hidden flex-1"
        style={{
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
          transition: 'opacity 150ms',
        }}
      >
        <Link href="/instructor/partnerships" className={linkClass('/instructor/partnerships')}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="truncate">Dashboard</span>
          <span className="ml-auto text-xs text-muted-text">{totalCount}</span>
        </Link>

        <p className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-text uppercase tracking-wide shrink-0">
          Departments
        </p>

        {ALL_DEPARTMENTS.map(dept => (
          <Link
            key={dept}
            href={`/instructor/partnerships/all?dept=${dept}`}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isDeptActive(dept)
                ? 'bg-teal-light text-teal-primary font-medium'
                : 'text-muted-text hover:text-dark-text hover:bg-background'
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${DEPT_DOT[dept]}`} />
            <span className={`truncate ${isDeptActive(dept) ? '' : DEPT_COLORS[dept]}`}>
              {DEPARTMENT_LABELS[dept]}
            </span>
            <span className="ml-auto text-xs text-muted-text shrink-0">{deptCounts[dept]}</span>
          </Link>
        ))}

        <div className="my-2 border-t border-border shrink-0" />

        <Link href="/instructor/partnerships/referrals" className={linkClass('/instructor/partnerships/referrals')}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">Student Referrals</span>
        </Link>

        <Link href="/instructor/partnerships/email-lists" className={linkClass('/instructor/partnerships/email-lists')}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="truncate">Email Lists</span>
        </Link>

        <div className="my-2 border-t border-border shrink-0" />

        <Link
          href="/instructor/partnerships/new"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-teal-primary hover:bg-teal-light transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="truncate">Add Partner</span>
        </Link>
      </div>

      {/* Drag-to-resize handle + border */}
      {!collapsed && (
        <div
          onMouseDown={handleDragStart}
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize group ${isResizing ? '' : ''}`}
          title="Drag to resize"
        >
          <div className={`absolute top-0 right-0 w-px h-full bg-border group-hover:bg-teal-primary/50 transition-colors ${isResizing ? 'bg-teal-primary/70' : ''}`} />
        </div>
      )}
      {/* Border when collapsed (non-draggable) */}
      {collapsed && <div className="absolute top-0 right-0 w-px h-full bg-border" />}
    </aside>
  )
}
