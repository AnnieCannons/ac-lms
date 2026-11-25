'use server'

import { revalidatePath } from 'next/cache'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getOnboardingActor } from '@/lib/onboarding-access'
import { loadCohortProgress, loadCohortStudents, loadFinishedAt } from '@/lib/onboarding-server'

// Moving an Enrollment Readiness cohort on to its next course (New Student Onboarding, phase 4).

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

/** Picks (or clears) the course an Enrollment Readiness cohort moves on to. */
export async function setOnboardingNextCourse(courseId: string, nextCourseId: string | null): Promise<Result> {
  const staff = await getOnboardingActor()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const admin = createServiceSupabaseClient()

  const { data: course } = await admin.from('courses').select('id, is_enrollment_readiness').eq('id', courseId).maybeSingle()
  if (!(course as { is_enrollment_readiness?: boolean } | null)?.is_enrollment_readiness) return { ok: false, error: 'That isn’t an Enrollment Readiness course.' }
  if (nextCourseId) {
    if (nextCourseId === courseId) return { ok: false, error: 'Choose a different course.' }
    const { data: next } = await admin.from('courses').select('id, is_enrollment_readiness, is_template').eq('id', nextCourseId).maybeSingle()
    const row = next as { is_enrollment_readiness?: boolean; is_template?: boolean } | null
    if (!row || row.is_template) return { ok: false, error: 'Choose a course.' }
    if (row.is_enrollment_readiness) return { ok: false, error: 'Choose the course they move on to, not another Enrollment Readiness course.' }
  }

  const { error } = await admin.from('courses').update({ onboarding_next_course_id: nextCourseId }).eq('id', courseId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/instructor/onboarding')
  return { ok: true }
}

/**
 * Enrolls every student who has finished the cohort into its next course as a student.
 * Anyone already in that course (in any role) is left as they are.
 */
export async function addFinishersToNextCourse(courseId: string): Promise<Result<{ added: number; alreadyThere: number }>> {
  const staff = await getOnboardingActor()
  if (!staff) return { ok: false, error: 'Not authorized.' }
  const admin = createServiceSupabaseClient()

  const { data: course } = await admin.from('courses')
    .select('id, is_enrollment_readiness, onboarding_next_course_id').eq('id', courseId).maybeSingle()
  const row = course as { is_enrollment_readiness?: boolean; onboarding_next_course_id?: string | null } | null
  if (!row?.is_enrollment_readiness) return { ok: false, error: 'That isn’t an Enrollment Readiness course.' }
  const nextId = row.onboarding_next_course_id
  if (!nextId) return { ok: false, error: 'Choose the next course first.' }

  const students = await loadCohortStudents(admin, courseId)
  const [{ progress }, finishedAt] = await Promise.all([
    loadCohortProgress(admin, courseId, students.map(s => s.id)),
    loadFinishedAt(admin, courseId),
  ])
  // Finished = every counted assignment Complete, or finished once already (their Completed tick)
  const finished = students.filter(s => progress.get(s.id)?.finished || finishedAt.has(s.id)).map(s => s.id)
  if (finished.length === 0) return { ok: true, added: 0, alreadyThere: 0 }

  const { data: existing } = await admin.from('course_enrollments').select('user_id').eq('course_id', nextId).in('user_id', finished)
  const there = new Set(((existing ?? []) as { user_id: string }[]).map(e => e.user_id))
  const toAdd = finished.filter(id => !there.has(id))
  if (toAdd.length) {
    const { error } = await admin.from('course_enrollments').insert(toAdd.map(user_id => ({ course_id: nextId, user_id, role: 'student' })))
    if (error) return { ok: false, error: error.message }
  }
  revalidatePath('/instructor/onboarding')
  revalidatePath(`/instructor/courses/${nextId}`, 'layout')
  return { ok: true, added: toAdd.length, alreadyThere: there.size }
}
