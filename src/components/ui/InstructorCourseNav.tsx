'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import AddAssignmentButton from './AddAssignmentButton'
import AddResourceButton from './AddResourceButton'
import InstructorGlobalNav from './InstructorGlobalNav'

interface Props {
  courseId: string
  courseName: string
}

const COURSE_SLUGS = ['syllabus', 'level-up', 'class-resources', 'career', 'assignments']

const CATEGORY_ITEMS = [
  { label: 'All Modules', slug: '' },
  { label: 'Syllabus', slug: 'syllabus' },
  { label: 'Assignments', slug: 'assignments' },
  { label: 'Level Up Your Skills', slug: 'level-up' },
  { label: 'Class Resources', slug: 'class-resources' },
  { label: 'Career Development', slug: 'career' },
]

export default function InstructorCourseNav({ courseId, courseName }: Props) {
  const pathname = usePathname()

  const navLink = (label: string, slug: string) => {
    const href = `/instructor/courses/${courseId}${slug ? `/${slug}` : ''}`
    let isActive: boolean
    if (slug === 'submissions') {
      isActive = pathname.startsWith(`/instructor/courses/${courseId}/submissions`)
    } else if (slug === 'assignments') {
      isActive = pathname.startsWith(`/instructor/courses/${courseId}/assignments`)
    } else if (slug === '') {
      isActive = pathname === href && !COURSE_SLUGS.some(s => pathname.endsWith(`/${s}`))
    } else {
      isActive = pathname === href
    }
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
      <p
        className="text-xs font-extrabold text-dark-text uppercase tracking-widest mb-1 px-3 truncate"
        title={courseName}
      >
        {courseName}
      </p>

      <div className="flex flex-col gap-2 mb-3 px-3">
        <AddAssignmentButton courseId={courseId} />
        <AddResourceButton courseId={courseId} />
      </div>

      <div className="flex flex-col gap-0.5">
        {navLink('General Info', 'info')}
        <p className="text-xs font-extrabold text-dark-text uppercase tracking-widest mt-4 mb-1 px-3">Course</p>
        {CATEGORY_ITEMS.map(({ label, slug }) => navLink(label, slug))}
        <p className="text-xs font-extrabold text-dark-text uppercase tracking-widest mt-4 mb-1 px-3">Grades</p>
        {navLink('Grades', 'submissions')}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <InstructorGlobalNav />
      </div>
    </nav>
  )
}
