'use server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getAuthedInstructor() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') return { error: 'Not authorized' as const }
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

  // Fetch course-level anchor groups
  const { data: anchorGroups } = await admin
    .from('grading_groups')
    .select('student_id, grader_id')
    .eq('course_id', courseId)
    .is('module_id', null)

  if (!anchorGroups || anchorGroups.length === 0) {
    return { error: 'Set up base groups first before enabling weekly rotation.' }
  }

  // Fetch graders ordered by name (stable sort)
  const { data: graderEnrollments } = await admin
    .from('course_enrollments')
    .select('user_id')
    .eq('course_id', courseId)
    .in('role', ['instructor', 'ta'])
  const graderIds = graderEnrollments?.map(e => e.user_id) ?? []
  const { data: graderUsers } = graderIds.length
    ? await admin.from('users').select('id').in('id', graderIds).order('name')
    : { data: [] }
  const graders = graderUsers ?? []
  if (graders.length === 0) return { error: 'No graders found.' }

  // Fetch modules ordered — published only, exclude career/level_up
  const { data: allModules } = await admin
    .from('modules')
    .select('id, order, category')
    .eq('course_id', courseId)
    .eq('published', true)
    .is('deleted_at', null)
    .order('order')
  if (!allModules || allModules.length === 0) return { error: 'No modules found.' }

  // Find which modules have at least one non-deleted assignment
  const allModuleIds = allModules.map(m => m.id)
  const { data: moduleDays } = await admin
    .from('module_days')
    .select('id, module_id')
    .in('module_id', allModuleIds)
    .is('deleted_at', null)
  const moduleDayIds = (moduleDays ?? []).map(d => d.id)
  const dayModuleMap = new Map((moduleDays ?? []).map(d => [d.id, d.module_id]))
  const moduleIdsWithAssignments = new Set<string>()
  if (moduleDayIds.length > 0) {
    const { data: assignmentDays } = await admin
      .from('assignments')
      .select('module_day_id')
      .in('module_day_id', moduleDayIds)
      .is('deleted_at', null)
      .eq('published', true)
    for (const a of assignmentDays ?? []) {
      const mid = dayModuleMap.get(a.module_day_id)
      if (mid) moduleIdsWithAssignments.add(mid)
    }
  }
  // Exclude career/level_up modules and those without published assignments
  const modules = (allModules as Array<{ id: string; order: number; category: string | null }>)
    .filter(m => m.category !== 'career' && m.category !== 'level_up' && moduleIdsWithAssignments.has(m.id))
  if (modules.length === 0) return { error: 'No modules with assignments found.' }

  // Build anchor map: studentId → grader index in sorted graders array
  const anchorMap = new Map<string, number>()
  for (const row of anchorGroups) {
    if (row.grader_id) {
      const idx = graders.findIndex(g => g.id === row.grader_id)
      if (idx !== -1) anchorMap.set(row.student_id, idx)
    }
  }

  // Delete any existing week-specific rows
  await admin.from('grading_groups')
    .delete()
    .eq('course_id', courseId)
    .not('module_id', 'is', null)

  // Generate week-specific rows for each module (rotating from anchor)
  const rowsToInsert: Array<{ course_id: string; module_id: string; student_id: string; grader_id: string }> = []
  const weeklyGroups: Record<string, Record<string, string | null>> = {}

  for (let i = 0; i < modules.length; i++) {
    const module = modules[i]
    weeklyGroups[module.id] = {}
    for (const [studentId, anchorIdx] of anchorMap) {
      const rotatedIdx = (anchorIdx + i) % graders.length
      const graderId = graders[rotatedIdx].id
      rowsToInsert.push({ course_id: courseId, module_id: module.id, student_id: studentId, grader_id: graderId })
      weeklyGroups[module.id][studentId] = graderId
    }
  }

  if (rowsToInsert.length > 0) {
    const { error } = await admin.from('grading_groups').insert(rowsToInsert)
    if (error) return { error: error.message }
  }

  revalidatePath(`/instructor/courses/${courseId}/grading-groups`)
  return { weeklyGroups }
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
