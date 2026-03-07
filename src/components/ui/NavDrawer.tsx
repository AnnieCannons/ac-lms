'use client'
import { useState } from 'react'
import StudentCourseNav from './StudentCourseNav'

const SIDEBAR_W = 240

interface Props {
  courseId: string
  courseName: string
  paidLearners?: boolean
  children: React.ReactNode
}

export default function NavDrawer({ courseId, courseName, paidLearners = false, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-[calc(100vh-83px)]">
      {/* Collapsible sidebar — in document flow so content pushes over */}
      <div className="relative shrink-0">
        {/* overflow-hidden on the animating div clips nav content at width:0 */}
        <div
          className={`overflow-hidden transition-[width] duration-200 ${open ? 'border-r border-border' : ''}`}
          style={{ width: open ? SIDEBAR_W : 0 }}
        >
          {/* Inner content at fixed width so it doesn't collapse */}
          <div className="py-8 px-3 h-full" style={{ width: SIDEBAR_W }}>
            <StudentCourseNav courseId={courseId} courseName={courseName} paidLearners={paidLearners} />
          </div>
        </div>

        {/* Half-circle toggle — on outer (non-clipping) div so it escapes */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          className="absolute top-6 right-0 translate-x-full z-20 w-5 h-14 rounded-r-full bg-teal-primary text-white flex items-center justify-center shadow-md hover:opacity-90 transition-opacity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {open ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
          </svg>
        </button>
      </div>

      {/* Page content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
