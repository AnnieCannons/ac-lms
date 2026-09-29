'use server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { generateAllWeeklyGroups, syncStudentsWeeklyGroups } from '@/lib/weekly-rotation'

async function getAuthedInstructor() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') return { error: 'Not authorized' as const }
  return { user, supabase, role: profile.role as string }
}

async function verifyInstructorCourseAccess(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  userRole: string,
  courseId: string
): Promise<boolean> {
  if (userRole === 'admin') return true
  const { data } = await supabase
    .from('course_enrollments')
    .select('role')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .eq('role', 'instructor')
    .maybeSingle()
  return !!data
}

export async function setStudentGrader(
  courseId: string,
  studentId: string,
  graderId: string | null,
  moduleId?: string | null
) {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase, role } = auth
  if (!await verifyInstructorCourseAccess(supabase, user.id, role, courseId)) return { error: 'Not authorized' }

  const admin = createServiceSupabaseClient()

  let wasAssigned = false
  if (!moduleId) {
    const { data: existing } = await admin.from('grading_groups')
      .select('grader_id').eq('course_id', courseId).eq('student_id', studentId).is('module_id', null).maybeSingle()
    wasAssigned = !!existing?.grader_id
  }

  // Delete existing row for this scope (course-level or specific module)
  let deleteQuery = admin
    .from('grading_groups')
    .delete()
    .eq('course_id', courseId)
    .eq('student_id', studentId)
  if (moduleId) {
    deleteQuery = deleteQuery.eq('module_id', moduleId)
  } else {
    deleteQuery = deleteQuery.is('module_id', null)
  }
  await deleteQuery

  if (graderId) {
    await admin.from('grading_groups').insert({
      course_id: courseId,
      student_id: studentId,
      grader_id: graderId,
      module_id: moduleId ?? null,
    })
  }

  // Base-group moves into/out of Unassigned carry through to every rotation week
  if (!moduleId) {
    const isAssigned = !!graderId
    await syncStudentsWeeklyGroups(admin, courseId, {
      added: !wasAssigned && isAssigned ? [studentId] : [],
      removed: wasAssigned && !isAssigned ? [studentId] : [],
    })
  }

  revalidatePath(`/instructor/courses/${courseId}/grading-groups`)
  return { success: true }
}

export async function bulkAssignStudentGraders(
  courseId: string,
  assignments: { studentId: string; graderId: string }[],
  moduleId?: string | null
): Promise<{ error?: string; success?: boolean }> {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase, role } = auth
  if (!await verifyInstructorCourseAccess(supabase, user.id, role, courseId)) return { error: 'Not authorized' }

  const admin = createServiceSupabaseClient()

  const { data: previousRows } = moduleId
    ? { data: [] }
    : await admin.from('grading_groups').select('student_id, grader_id').eq('course_id', courseId).is('module_id', null)
  const previouslyAssigned = new Set((previousRows ?? []).filter(r => r.grader_id).map(r => r.student_id))

  // Delete only rows in this scope (course-level or specific module)
  let deleteQuery = admin.from('grading_groups').delete().eq('course_id', courseId)
  if (moduleId) {
    deleteQuery = deleteQuery.eq('module_id', moduleId)
  } else {
    deleteQuery = deleteQuery.is('module_id', null)
  }
  await deleteQuery

  if (assignments.length > 0) {
    const { error } = await admin.from('grading_groups').insert(
      assignments.map(a => ({
        course_id: courseId,
        student_id: a.studentId,
        grader_id: a.graderId,
        module_id: moduleId ?? null,
      }))
    )
    if (error) return { error: error.message }
  }

  if (!moduleId) {
    const nowAssigned = new Set(assignments.map(a => a.studentId))
    await syncStudentsWeeklyGroups(admin, courseId, {
      added: [...nowAssigned].filter(id => !previouslyAssigned.has(id)),
      removed: [...previouslyAssigned].filter(id => !nowAssigned.has(id)),
    })
  }

  revalidatePath(`/instructor/courses/${courseId}/grading-groups`)
  return { success: true }
}

export async function enableWeeklyRotation(
  courseId: string
): Promise<{ error?: string; weeklyGroups?: Record<string, Record<string, string | null>> }> {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase, role } = auth
  if (!await verifyInstructorCourseAccess(supabase, user.id, role, courseId)) return { error: 'Not authorized' }

  const admin = createServiceSupabaseClient()
  const result = await generateAllWeeklyGroups(admin, courseId)
  if (result.error) return { error: result.error }

  revalidatePath(`/instructor/courses/${courseId}/grading-groups`)
  return { weeklyGroups: result.weeklyGroups }
}

export async function disableWeeklyRotation(
  courseId: string
): Promise<{ error?: string; success?: boolean }> {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase, role } = auth
  if (!await verifyInstructorCourseAccess(supabase, user.id, role, courseId)) return { error: 'Not authorized' }

  const admin = createServiceSupabaseClient()
  await admin.from('grading_groups')
    .delete()
    .eq('course_id', courseId)
    .not('module_id', 'is', null)

  revalidatePath(`/instructor/courses/${courseId}/grading-groups`)
  return { success: true }
}

export async function setAssignmentGrader(
  assignmentId: string,
  graderId: string | null,
  courseId: string
): Promise<{ error?: string; success?: boolean }> {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }

  const hasAccess = await verifyInstructorCourseAccess(auth.supabase, auth.user.id, auth.role, courseId)
  if (!hasAccess) return { error: 'Not authorized for this course' }

  const admin = createServiceSupabaseClient()

  // Verify the assignment belongs to this course via module_days → modules → course_id
  const { data: check } = await admin
    .from('assignments')
    .select('id, module_days!module_day_id(modules!module_id(course_id))')
    .eq('id', assignmentId)
    .single()

  // Supabase returns nested FK as arrays; extract course_id from the join
  const days = check?.module_days as unknown as Array<{ modules: { course_id: string } | { course_id: string }[] }> | null
  const firstDay = Array.isArray(days) ? days[0] : null
  const mod = firstDay?.modules
  const assignmentCourseId = mod ? (Array.isArray(mod) ? mod[0]?.course_id : mod.course_id) : null
  if (assignmentCourseId !== courseId) return { error: 'Assignment not found in this course' }

  const { error } = await admin
    .from('assignments')
    .update({ grader_id: graderId })
    .eq('id', assignmentId)

  if (error) return { error: error.message }
  return { success: true }
}

// Hide (or un-hide) a staff member/TA from this course's grading groups. Hiding
// also unassigns their students (base + weekly groups) and clears any
// assignment overrides pointing at them, so nothing is left routed to them.
export async function setGraderExcluded(
  courseId: string,
  graderId: string,
  excluded: boolean
): Promise<{ error?: string; success?: boolean }> {
  const auth = await getAuthedInstructor()
  if ('error' in auth) return { error: auth.error }
  const { user, supabase, role } = auth
  if (!await verifyInstructorCourseAccess(supabase, user.id, role, courseId)) return { error: 'Not authorized' }

  const admin = createServiceSupabaseClient()

  const { error } = await admin
    .from('course_enrollments')
    .update({ excluded_from_grading: excluded })
    .eq('course_id', courseId)
    .eq('user_id', graderId)
    .in('role', ['instructor', 'ta', 'staff'])
  if (error) return { error: error.message }

  if (excluded) {
    await admin.from('grading_groups')
      .delete()
      .eq('course_id', courseId)
      .eq('grader_id', graderId)

    const { data: modules } = await admin.from('modules').select('id').eq('course_id', courseId)
    const moduleIds = (modules ?? []).map(m => m.id)
    const { data: days } = moduleIds.length
      ? await admin.from('module_days').select('id').in('module_id', moduleIds)
      : { data: [] }
    const dayIds = (days ?? []).map(d => d.id)
    if (dayIds.length > 0) {
      await admin.from('assignments')
        .update({ grader_id: null })
        .in('module_day_id', dayIds)
        .eq('grader_id', graderId)
    }
  }

  revalidatePath(`/instructor/courses/${courseId}/grading-groups`)
  return { success: true }
}
