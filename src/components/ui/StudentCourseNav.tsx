'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface Props {
  courseId: string
  courseName: string
  paidLearners?: boolean
}

const TOP_ITEMS = [
  { label: 'General Info', slug: 'info' },
]

const COURSE_ITEMS = [
  { label: 'Syllabus', slug: '' },
  { label: 'Assignments', slug: 'assignments' },
  { label: 'Class Resources', slug: 'class-resources' },
  { label: 'Career Development', slug: 'career' },
  { label: 'Level Up Your Skills', slug: 'level-up' },
]

const PAID_ITEMS = [
  { label: 'Benefits', slug: 'benefits' },
  { label: 'Paid Time Off', slug: 'pto' },
]

export default function StudentCourseNav({ courseId, courseName, paidLearners }: Props) {
  const pathname = usePathname()

  const navLink = (label: string, slug: string) => {
    const href = `/student/courses/${courseId}${slug ? `/${slug}` : ''}`
    const isActive = pathname === href
    return (
      <Link
        key={label}
        href={href}
        className={`pl-5 pr-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-teal-light text-teal-primary'
            : 'text-muted-text hover:text-dark-text hover:bg-border/20'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <nav aria-label="Course navigation" className="flex flex-col">
      <p className="text-xs font-extrabold text-dark-text uppercase tracking-widest mb-1 px-3 truncate" title={courseName}>
        {courseName}
      </p>
      <div className="flex flex-col gap-0.5">
        {TOP_ITEMS.map(({ label, slug }) => navLink(label, slug))}
        <p className="text-xs font-extrabold text-dark-text uppercase tracking-widest mt-4 mb-1 px-3">Course</p>
        {COURSE_ITEMS.map(({ label, slug }) => navLink(label, slug))}
        {paidLearners && (
          <>
            <p className="text-xs font-extrabold text-dark-text uppercase tracking-widest mt-4 mb-1 px-3">Employment</p>
            {PAID_ITEMS.map(({ label, slug }) => navLink(label, slug))}
          </>
        )}
      </div>
    </nav>
  )
}
