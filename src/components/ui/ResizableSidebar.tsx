'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

const MIN_WIDTH = 160
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 224 // w-56

export default function ResizableSidebar({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [collapsed, setCollapsed] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const widthRef = useRef(DEFAULT_WIDTH)
  widthRef.current = width

  useEffect(() => {
    try {
      const w = localStorage.getItem('sidebar-width')
      const c = localStorage.getItem('sidebar-collapsed')
      if (w) { const n = parseInt(w); setWidth(n); widthRef.current = n }
      if (c === 'true') setCollapsed(true)
      else if (c === null && window.innerWidth < 768) setCollapsed(true)
    } catch {}
  }, [])
  const startXRef = useRef(0)
  const startWidthRef = useRef(DEFAULT_WIDTH)

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
      try { localStorage.setItem('sidebar-width', String(widthRef.current)) } catch {}
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('sidebar-collapsed', String(next)) } catch {}
  }

  return (
    <div
      className="sticky top-[65px] self-start shrink-0 border-r border-border h-[calc(100vh-65px)] overflow-visible"
      style={{ width: collapsed ? 0 : width }}
    >
      {/* Nav content */}
      <div
        className="py-8 px-3 overflow-x-hidden overflow-y-auto h-full"
        style={{ width: collapsed ? 0 : width }}
      >
        {!collapsed && children}
      </div>

      {/* Drag handle — hover zone on right border */}
      {!collapsed && (
        <div
          className={`absolute inset-y-0 right-0 w-2 cursor-col-resize transition-colors ${
            isResizing ? 'bg-teal-primary/30' : 'hover:bg-teal-primary/20'
          }`}
          onMouseDown={handleDragStart}
        />
      )}

      {/* Toggle button — centered on right border */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        className={`absolute top-6 right-0 z-20 hidden sm:flex w-7 h-7 rounded-full bg-surface border border-border items-center justify-center text-muted-text hover:text-dark-text hover:border-dark-text transition-colors shadow-sm text-xs leading-none ${collapsed ? 'translate-x-full' : 'translate-x-1/2'}`}
      >
        <span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
      </button>
    </div>
  )
}
