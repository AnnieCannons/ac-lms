'use client'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Props {
  courseId: string
  courseName: string
  paidLearners?: boolean
}

const TOP_ITEMS = [
  { label: 'General Info', slug: 'info' },
]

const COURSE_ITEMS = [
  { label: 'Course Outline', slug: '' },
  { label: 'Grades', slug: 'assignments' },
  { label: 'Quizzes', slug: 'quizzes' },
  { label: 'Class Resources', slug: 'class-resources' },
  { label: 'Career Development', slug: 'career' },
  { label: 'Level Up Your Skills', slug: 'level-up' },
]

const PAID_ITEMS = [
  { label: 'Benefits', slug: 'benefits' },
  { label: 'Paid Time Off', slug: 'pto' },
]

// "New" badge on Level Up Your Skills after its redesign: hidden once the student opens
// Level Up, and switched off entirely after NEW_UNTIL so later cohorts never see it.
// "Seen" is remembered per user in this browser — keyed by user id, so on a shared
// classroom computer one student opening Level Up doesn't hide it for the next. Until
// the user is known (and on the server) no badge shows.
const LEVEL_UP_NEW_UNTIL = new Date('2026-11-30T23:59:59')
const levelUpSeenKey = (userId: string) => `level-up-redesign-seen:${userId}`
const seenListeners = new Set<() => void>()
function readLevelUpSeen(userId: string | null) {
  if (!userId) return true
  try { return localStorage.getItem(levelUpSeenKey(userId)) === '1' } catch { return true }
}
function markLevelUpSeen(userId: string) {
  try { localStorage.setItem(levelUpSeenKey(userId), '1') } catch {}
  seenListeners.forEach(l => l())
}
function subscribeLevelUpSeen(listener: () => void) {
  seenListeners.add(listener)
  window.addEventListener('storage', listener)
  return () => { seenListeners.delete(listener); window.removeEventListener('storage', listener) }
}

export default function StudentCourseNav({ courseId, courseName, paidLearners }: Props) {
  const pathname = usePathname()
  const [isTa, setIsTa] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      if (!cancelled) setUserId(user.id)
      supabase
        .from('course_enrollments')
        .select('role')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setIsTa(data?.role === 'ta')
        })
    })
    return () => { cancelled = true }
  }, [courseId])

  const getLevelUpSeen = useCallback(() => readLevelUpSeen(userId), [userId])
  const levelUpSeen = useSyncExternalStore(subscribeLevelUpSeen, getLevelUpSeen, () => true)
  const onLevelUp = pathname.startsWith(`/student/courses/${courseId}/level-up`)
  useEffect(() => {
    if (onLevelUp && userId && !readLevelUpSeen(userId)) markLevelUpSeen(userId)
  }, [onLevelUp, userId])
  const showLevelUpNew = !levelUpSeen && !onLevelUp && new Date() < LEVEL_UP_NEW_UNTIL

  const navLink = (label: string, slug: string) => {
    const href = `/student/courses/${courseId}${slug ? `/${slug}` : ''}`
    const isActive = pathname === href
    const isNew = slug === 'level-up' && showLevelUpNew
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
        {isNew && (
          <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wide bg-purple-light text-purple-primary border border-purple-primary/30 rounded-full px-1.5 py-0.5">
            New
          </span>
        )}
      </Link>
    )
  }

  return (
    <nav aria-label="Course navigation" className="flex flex-col">
      <p className="text-xs font-extrabold text-dark-text uppercase tracking-widest mb-3 px-3 truncate" title={courseName}>
        {courseName}
      </p>
      <div className="flex flex-col gap-0.5 pb-4">
        {isTa && (
          <Link
            href={`/instructor/courses/${courseId}`}
            className="pl-5 pr-3 py-2 mb-2 rounded-lg text-sm font-semibold bg-teal-light text-teal-primary hover:bg-teal-light/70 transition-colors"
          >
            TA / Instructor View →
          </Link>
        )}
        {TOP_ITEMS.map(({ label, slug }) => navLink(label, slug))}
        <p className="text-xs font-extrabold text-dark-text uppercase tracking-widest mt-8 mb-1 px-3">Course</p>
        {COURSE_ITEMS.map(({ label, slug }) => navLink(label, slug))}
        {paidLearners && (
          <>
            <p className="text-xs font-extrabold text-dark-text uppercase tracking-widest mt-4 mb-1 px-3">Employment</p>
            {PAID_ITEMS.map(({ label, slug }) => navLink(label, slug))}
          </>
        )}
      </div>

      <div className="mt-auto pt-6 px-3 border-t border-border">
        <Link
          href="/account"
          className={`block pl-2 pr-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === '/account'
              ? 'bg-teal-light text-teal-primary'
              : 'text-muted-text hover:text-dark-text hover:bg-border/20'
          }`}
        >
          Profile
        </Link>
      </div>
    </nav>
  )
}
