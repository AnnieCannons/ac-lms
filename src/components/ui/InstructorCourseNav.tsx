'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import CreateButton from './CreateButton'
import InstructorGlobalNav from './InstructorGlobalNav'
import LaunchSetupButton from './LaunchSetupButton'
import StudentViewButton from './StudentViewButton'

interface Props {
  courseId: string
  courseName: string
  needsGrading?: number
  firstUngradedAssignmentId?: string | null
  myGroupNeedsGrading?: number
  myGroupFirstAssignmentId?: string | null
  isTa?: boolean
}

const COURSE_SLUGS = ['syllabus', 'level-up', 'class-resources', 'career', 'assignments', 'quizzes', 'quiz-submissions']

function useNavSection(key: string, defaultOpen = true): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return defaultOpen
    const stored = localStorage.getItem(key)
    return stored === null ? defaultOpen : stored === 'true'
  })
  const toggle = () => setOpen(v => {
    const next = !v
    localStorage.setItem(key, String(next))
    return next
  })
  return [open, toggle]
}

const CATEGORY_ITEMS = [
  { label: 'All Modules', slug: '' },
  { label: 'Course Outline', slug: 'syllabus' },
  { label: 'Assignments', slug: 'assignments' },
  { label: 'Quizzes', slug: 'quizzes' },
  { label: 'Class Resources', slug: 'class-resources' },
  { label: 'Career Development', slug: 'career' },
  { label: 'Level Up Your Skills', slug: 'level-up' },
]

function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1.5 w-full px-3 mt-6 mb-1 group"
    >
      <span className="text-muted-text text-[8px] group-hover:text-dark-text transition-colors">{open ? '▲' : '▼'}</span>
      <p className="text-xs font-extrabold text-dark-text uppercase tracking-widest">{label}</p>
    </button>
  )
}

export default function InstructorCourseNav({
  courseId,
  courseName,
  needsGrading = 0,
  firstUngradedAssignmentId = null,
  myGroupNeedsGrading = 0,
  myGroupFirstAssignmentId = null,
  isTa = false,
}: Props) {
  const pathname = usePathname()
  const [graderOpen, setGraderOpen] = useState(false)
  const [courseOpen, toggleCourseOpen] = useNavSection('nav_section_course')
  const [activeConductUrl, setActiveConductUrl] = useState<string | null>(null)

  useEffect(() => {
    try {
      setActiveConductUrl(localStorage.getItem(`conductingQuiz_${courseId}`))
    } catch {}
  }, [courseId, pathname])
  const [gradesOpen, toggleGradesOpen] = useNavSection('nav_section_grades')
  const [employmentOpen, toggleEmploymentOpen] = useNavSection('nav_section_employment')

  const navLink = (label: string, slug: string) => {
    const baseHref = `/instructor/courses/${courseId}${slug ? `/${slug}` : ''}`
    const isOnConduct = pathname.includes('/conduct')
    const href = slug === 'quizzes' && activeConductUrl && !isOnConduct
      ? activeConductUrl
      : baseHref
    let isActive: boolean
    if (slug === 'submissions') {
      isActive = pathname.startsWith(`/instructor/courses/${courseId}/submissions`)
    } else if (slug === 'assignments') {
      isActive = pathname.startsWith(`/instructor/courses/${courseId}/assignments`)
    } else if (slug === 'quizzes') {
      isActive = pathname.startsWith(`/instructor/courses/${courseId}/quizzes`) ||
        pathname.startsWith(`/instructor/courses/${courseId}/quiz-submissions`)
    } else if (slug === 'users') {
      isActive = pathname.startsWith(`/instructor/courses/${courseId}/users`)
    } else if (slug === 'roster') {
      isActive = pathname.startsWith(`/instructor/courses/${courseId}/roster`)
    } else if (slug === '') {
      isActive = pathname === baseHref && !COURSE_SLUGS.some(s => pathname.endsWith(`/${s}`))
    } else {
      isActive = pathname === baseHref
    }
    const isConductShortcut = slug === 'quizzes' && activeConductUrl && !isOnConduct
    return (
      <Link
        key={label}
        href={href}
        className={`pl-5 pr-3 py-2 rounded-lg text-sm font-medium transition-colors truncate ${
          isActive
            ? 'bg-teal-light text-teal-primary'
            : 'text-muted-text hover:text-dark-text hover:bg-border/20'
        }`}
        title={isConductShortcut ? 'Return to active quiz moderation' : undefined}
      >
        {label}
        {isConductShortcut && <span className="ml-1.5 text-[10px] font-bold text-amber-500">●</span>}
      </Link>
    )
  }

  return (
    <nav aria-label="Course navigation" className="flex flex-col">
      <p
        className="text-xs font-extrabold text-dark-text uppercase tracking-widest mb-4 px-3 truncate"
        title={courseName}
      >
        {courseName}
      </p>

      {!isTa && (
        <div className="mb-6 px-3">
          <CreateButton courseId={courseId} />
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {navLink('General Info', 'info')}
        {!isTa && navLink('Users', 'users')}
        {navLink('Roster', 'roster')}

        <SectionHeader label="Course" open={courseOpen} onToggle={toggleCourseOpen} />
        {courseOpen && CATEGORY_ITEMS.map(({ label, slug }) => navLink(label, slug))}

        <SectionHeader label="Grades" open={gradesOpen} onToggle={toggleGradesOpen} />
        {gradesOpen && (
          <>
            <GradesNavLink courseId={courseId} needsGrading={isTa ? myGroupNeedsGrading : needsGrading} pathname={pathname} />
            <button
              onClick={() => setGraderOpen(true)}
              className="pl-5 pr-3 py-2 rounded-lg text-sm font-medium transition-colors text-left text-muted-text hover:text-dark-text hover:bg-border/20 flex items-center justify-between gap-2"
            >
              <span>Launch Grader →</span>
              {myGroupNeedsGrading > 0 && (
                <span
                  className="text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 badge-count"
                  title="Ungraded in your grading group"
                >
                  {myGroupNeedsGrading}
                </span>
              )}
            </button>
            {!isTa && navLink('Grading Groups', 'grading-groups')}
          </>
        )}

        {!isTa && (
          <TrashNavLink courseId={courseId} pathname={pathname} />
        )}

        {isTa && (
          <>
            <SectionHeader label="Employment" open={employmentOpen} onToggle={toggleEmploymentOpen} />
            {employmentOpen && (
              <>
                <Link
                  href={`/student/courses/${courseId}/benefits`}
                  className="pl-5 pr-3 py-2 rounded-lg text-sm font-medium transition-colors text-muted-text hover:text-dark-text hover:bg-border/20"
                >
                  Benefits
                </Link>
                <Link
                  href={`/student/courses/${courseId}/pto`}
                  className="pl-5 pr-3 py-2 rounded-lg text-sm font-medium transition-colors text-muted-text hover:text-dark-text hover:bg-border/20"
                >
                  Paid Time Off
                </Link>
              </>
            )}
          </>
        )}
      </div>

      {!isTa && (
        <>
          <div className="mt-6 pt-4 border-t border-border">
            <InstructorGlobalNav courseId={courseId} />
          </div>

          <div className="mt-auto pt-6 px-3 flex flex-col gap-2">
            <StudentViewButton courseId={courseId} />
            <LaunchSetupButton courseId={courseId} />
          </div>
        </>
      )}

      {graderOpen && (
        <LaunchGraderModal
          courseId={courseId}
          needsGrading={needsGrading}
          firstUngradedAssignmentId={firstUngradedAssignmentId}
          myGroupNeedsGrading={myGroupNeedsGrading}
          myGroupFirstAssignmentId={myGroupFirstAssignmentId}
          onClose={() => setGraderOpen(false)}
        />
      )}
    </nav>
  )
}

function TrashNavLink({ courseId, pathname }: { courseId: string; pathname: string }) {
  const href = `/instructor/courses/${courseId}/trash`
  const isActive = pathname.startsWith(href)
  const router = useRouter()
  const [showEmptyPrompt, setShowEmptyPrompt] = useState(false)

  useEffect(() => {
    // Show weekly popup if trash has items and we haven't shown it this week
    const key = `trashPrompt_${courseId}`
    const lastShown = localStorage.getItem(key)
    const now = Date.now()
    const oneWeek = 7 * 24 * 60 * 60 * 1000
    if (!lastShown || now - parseInt(lastShown, 10) > oneWeek) {
      // Check if there are trashed items by fetching the trash page
      // We do this lazily — the popup only shows after we have confirmed items exist
      // We use a flag stored in localStorage when trash has items
      const hasItems = localStorage.getItem(`trashHasItems_${courseId}`) === 'true'
      if (hasItems) {
        localStorage.setItem(key, String(now))
        setShowEmptyPrompt(true)
      }
    }
  }, [courseId])

  return (
    <>
      <Link
        href={href}
        className={`pl-5 pr-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
          isActive
            ? 'bg-teal-light text-teal-primary'
            : 'text-muted-text hover:text-dark-text hover:bg-border/20'
        }`}
      >
        <span className="text-base leading-none">🗑</span>
        <span>Trash</span>
      </Link>

      {showEmptyPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowEmptyPrompt(false)}>
          <div className="bg-surface border border-border rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="text-3xl mb-3">🗑️</div>
            <h2 className="text-lg font-bold text-dark-text mb-2">Empty trash?</h2>
            <p className="text-sm text-muted-text mb-5">
              You have items in the trash for this course. Would you like to permanently delete them now, or review them first?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowEmptyPrompt(false); router.push(href) }}
                className="flex-1 px-4 py-2 rounded-full border border-border text-sm font-medium text-dark-text hover:bg-border/20 transition-colors"
              >
                Review trash
              </button>
              <button
                onClick={() => {
                  setShowEmptyPrompt(false)
                  localStorage.removeItem(`trashHasItems_${courseId}`)
                  router.push(`${href}?action=empty`)
                }}
                className="flex-1 px-4 py-2 rounded-full bg-red-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Empty trash
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function GradesNavLink({ courseId, needsGrading, pathname }: { courseId: string; needsGrading: number; pathname: string }) {
  const href = `/instructor/courses/${courseId}/submissions`
  const isActive = pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={`pl-5 pr-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between gap-2 ${
        isActive
          ? 'bg-teal-light text-teal-primary'
          : 'text-muted-text hover:text-dark-text hover:bg-border/20'
      }`}
    >
      <span>Grades</span>
      {needsGrading > 0 && (
        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 badge-count"
          title="Total ungraded across all students"
        >
          {needsGrading}
        </span>
      )}
    </Link>
  )
}

function LaunchGraderModal({
  courseId,
  needsGrading,
  firstUngradedAssignmentId,
  myGroupNeedsGrading,
  myGroupFirstAssignmentId,
  onClose,
}: {
  courseId: string
  needsGrading: number
  firstUngradedAssignmentId: string | null
  myGroupNeedsGrading: number
  myGroupFirstAssignmentId: string | null
  onClose: () => void
}) {
  const router = useRouter()

  const choose = (mode: 'students' | 'assignments' | 'all' | 'me') => {
    onClose()
    if (mode === 'students') {
      router.push(`/instructor/courses/${courseId}/submissions?tab=students`)
    } else if (mode === 'assignments') {
      router.push(`/instructor/courses/${courseId}/submissions?tab=assignments`)
    } else if (mode === 'all' && firstUngradedAssignmentId) {
      router.push(`/instructor/courses/${courseId}/assignments/${firstUngradedAssignmentId}/submissions?grader=all`)
    } else if (mode === 'me' && myGroupFirstAssignmentId) {
      router.push(`/instructor/courses/${courseId}/assignments/${myGroupFirstAssignmentId}/submissions?grader=me`)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface rounded-2xl border border-border shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-dark-text">Launch Grader</h2>
          <button
            onClick={onClose}
            className="text-muted-text hover:text-dark-text w-6 h-6 flex items-center justify-center text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-3 flex flex-col gap-2">
          <button
            onClick={() => choose('students')}
            className="w-full text-left px-4 py-3.5 rounded-xl border border-border hover:border-teal-primary/40 hover:bg-teal-light/30 transition-colors group"
          >
            <p className="text-sm font-semibold text-dark-text group-hover:text-teal-primary">By Student</p>
            <p className="text-xs text-muted-text mt-0.5">See each student with their assignment statuses</p>
          </button>

          <button
            onClick={() => choose('assignments')}
            className="w-full text-left px-4 py-3.5 rounded-xl border border-border hover:border-teal-primary/40 hover:bg-teal-light/30 transition-colors group"
          >
            <p className="text-sm font-semibold text-dark-text group-hover:text-teal-primary">By Assignment</p>
            <p className="text-xs text-muted-text mt-0.5">See each assignment with submission counts and ungraded work</p>
          </button>

          <button
            onClick={() => choose('all')}
            disabled={!firstUngradedAssignmentId}
            className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors group ${
              firstUngradedAssignmentId
                ? 'card-yellow'
                : 'border-border opacity-40 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className={`text-sm font-semibold ${firstUngradedAssignmentId ? 'badge-count' : 'text-muted-text'}`}>
                Grade All Ungraded
              </p>
              {needsGrading > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full badge-count shrink-0">
                  {needsGrading} waiting
                </span>
              )}
            </div>
            <p className="text-xs text-muted-text mt-0.5">
              {firstUngradedAssignmentId
                ? 'Jump straight into grading — move through each assignment with ungraded work'
                : 'No submissions need grading right now'}
            </p>
          </button>

          <button
            onClick={() => choose('me')}
            disabled={!myGroupFirstAssignmentId}
            className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors group ${
              myGroupFirstAssignmentId
                ? 'border-border hover:border-teal-primary/40 hover:bg-teal-light/30'
                : 'border-border opacity-40 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className={`text-sm font-semibold ${myGroupFirstAssignmentId ? 'text-dark-text group-hover:text-teal-primary' : 'text-muted-text'}`}>
                Grade for My Group
              </p>
              {myGroupNeedsGrading > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full badge-count shrink-0">
                  {myGroupNeedsGrading} waiting
                </span>
              )}
            </div>
            <p className="text-xs text-muted-text mt-0.5">
              {myGroupFirstAssignmentId
                ? 'Grade only submissions assigned to you'
                : 'No submissions in your group need grading'}
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
