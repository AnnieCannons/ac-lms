'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

const STUDENT_SECTIONS = [
  { slug: 'getting-started', label: 'Getting Started' },
  { slug: 'courses', label: 'Course Outline' },
  { slug: 'assignments', label: 'Assignments' },
  { slug: 'quizzes', label: 'Quizzes' },
  { slug: 'resources', label: 'Resources' },
  { slug: 'observer', label: 'Observer Mode' },
]

const INSTRUCTOR_SECTIONS = [
  { slug: 'getting-started', label: 'Getting Started' },
  { slug: 'course-editor', label: 'Course Editor' },
  { slug: 'resources', label: 'Managing Resources' },
  { slug: 'assignments', label: 'Assignments & Grading' },
  { slug: 'quizzes', label: 'Quizzes' },
  { slug: 'people', label: 'People & Enrollment' },
  { slug: 'roster', label: 'Roster & Progress' },
  { slug: 'student-preview', label: 'Student Preview' },
]

interface DocsLayoutProps {
  children: ReactNode
  guide: 'student' | 'instructor'
  section: string
  isInstructor: boolean
  backHref: string
}

export default function DocsLayout({ children, guide, section, isInstructor, backHref }: DocsLayoutProps) {
  const pathname = usePathname()
  const sections = guide === 'student' ? STUDENT_SECTIONS : INSTRUCTOR_SECTIONS

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-border px-6 py-4 flex items-center justify-between flex-shrink-0">
        <Link href={backHref} className="text-xl font-extrabold text-dark-text">
          AC<span className="text-teal-primary">*</span>
          <span className="ml-3 text-base font-semibold text-muted-text">Documentation</span>
        </Link>

        {isInstructor && (
          <div className="flex items-center gap-2">
            <Link
              href="/docs/student/getting-started"
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                guide === 'student'
                  ? 'bg-teal-primary text-white'
                  : 'border border-border text-muted-text hover:text-dark-text'
              }`}
            >
              Student Docs
            </Link>
            <Link
              href="/docs/instructor/getting-started"
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                guide === 'instructor'
                  ? 'bg-teal-primary text-white'
                  : 'border border-border text-muted-text hover:text-dark-text'
              }`}
            >
              Instructor Docs
            </Link>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 bg-surface border-r border-border flex flex-col py-4 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-text uppercase tracking-widest px-4 mb-3">
            {guide === 'student' ? 'Student Docs' : 'Instructor Docs'}
          </p>
          <nav className="flex-1 px-2 space-y-0.5">
            {sections.map(({ slug, label }) => {
              const href = `/docs/${guide}/${slug}`
              const isActive = pathname === href
              return (
                <Link
                  key={slug}
                  href={href}
                  className={`block px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive
                      ? 'bg-teal-light text-teal-primary font-medium'
                      : 'text-muted-text hover:text-dark-text hover:bg-border/20'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="px-2 mt-4 pt-4 border-t border-border">
            <Link
              href={backHref}
              className="block px-3 py-2 text-sm rounded-lg text-muted-text hover:text-dark-text hover:bg-border/20 transition-colors"
            >
              ← Back to App
            </Link>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
