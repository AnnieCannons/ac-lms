'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface Props {
  courseId: string
  courseName: string
}

const NAV_ITEMS = [
  { label: 'General Info', slug: 'info' },
  { label: 'Course Outline', slug: '' },
  { label: 'All Submissions', slug: 'submissions' },
]

export default function InstructorCourseNav({ courseId, courseName }: Props) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col">
      <p className="text-[10px] font-bold text-muted-text uppercase tracking-widest mb-4 px-3 truncate" title={courseName}>
        {courseName}
      </p>
      <div className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ label, slug }) => {
          const href = `/instructor/courses/${courseId}${slug ? `/${slug}` : ''}`
          const isActive = pathname === href
          return (
            <Link
              key={label}
              href={href}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-teal-light text-teal-primary'
                  : 'text-muted-text hover:text-dark-text hover:bg-border/20'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
