// Server-side only — weekly grading-group rotation. Deliberately NOT a 'use server'
// module: these helpers take a service-role client and do no auth checks of their
// own, so they must only be called from code that has already verified the caller
// (grading-groups actions/page) or from the CRON_SECRET-gated cron route.
//
// Model: course-level grading_groups rows (module_id IS NULL) are the "anchor".
// Week N of rotation gives each anchored student grader[(anchorIdx + N) % graders].
// Students with no anchor row are unassigned and stay out of every week until
// someone assigns them in the base groups.

import type { createServiceSupabaseClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'

type AdminClient = ReturnType<typeof createServiceSupabaseClient>

type RotationContext = {
  graders: { id: string }[]
  modules: { id: string }[]
  anchorMap: Map<string, number> // studentId → index into graders
}

// Graders (name-sorted, excluding anyone removed from grading), rotation-eligible
// modules in order, and each assigned student's anchor grader index.
async function loadRotationContext(admin: AdminClient, courseId: string): Promise<RotationContext> {
  const [{ data: graderEnrollments }, { data: anchorGroups }, { data: allModules }] = await Promise.all([
    admin.from('course_enrollments')
      .select('user_id')
      .eq('course_id', courseId)
      .in('role', ['instructor', 'ta', 'staff'])
      .eq('excluded_from_grading', false),
    admin.from('grading_groups')
      .select('student_id, grader_id')
      .eq('course_id', courseId)
      .is('module_id', null),
    admin.from('modules')
      .select('id, order, category')
      .eq('course_id', courseId)
      .eq('published', true)
      .is('deleted_at', null)
      .order('order'),
  ])

  const graderIds = graderEnrollments?.map(e => e.user_id) ?? []
  const { data: graderUsers } = graderIds.length
    ? await admin.from('users').select('id').in('id', graderIds).order('name')
    : { data: [] }
  const graders = graderUsers ?? []

  // Only non-career modules that have at least one published assignment
  const candidateModules = ((allModules ?? []) as { id: string; order: number; category: string | null }[])
    .filter(m => m.category !== 'career' && m.category !== 'level_up')
  const moduleIdsWithAssignments = new Set<string>()
  if (candidateModules.length > 0) {
    const { data: moduleDays } = await admin
      .from('module_days')
      .select('id, module_id')
      .in('module_id', candidateModules.map(m => m.id))
      .is('deleted_at', null)
    const dayModuleMap = new Map((moduleDays ?? []).map(d => [d.id, d.module_id]))
    if (dayModuleMap.size > 0) {
      const { data: assignmentDays } = await admin
        .from('assignments')
        .select('module_day_id')
        .in('module_day_id', [...dayModuleMap.keys()])
        .is('deleted_at', null)
        .eq('published', true)
      for (const a of assignmentDays ?? []) {
        const mid = dayModuleMap.get(a.module_day_id)
        if (mid) moduleIdsWithAssignments.add(mid)
      }
    }
  }
  const modules = candidateModules.filter(m => moduleIdsWithAssignments.has(m.id))

  const anchorMap = new Map<string, number>()
  for (const row of anchorGroups ?? []) {
    if (!row.grader_id) continue
    const idx = graders.findIndex(g => g.id === row.grader_id)
    if (idx !== -1) anchorMap.set(row.student_id, idx)
  }

  return { graders, modules, anchorMap }
}

function rotatedRows(ctx: RotationContext, courseId: string, moduleIndexes: number[], studentIds?: string[]) {
  const rows: { course_id: string; module_id: string; student_id: string; grader_id: string }[] = []
  for (const i of moduleIndexes) {
    const moduleId = ctx.modules[i].id
    for (const [studentId, anchorIdx] of ctx.anchorMap) {
      if (studentIds && !studentIds.includes(studentId)) continue
      rows.push({
        course_id: courseId,
        module_id: moduleId,
        student_id: studentId,
        grader_id: ctx.graders[(anchorIdx + i) % ctx.graders.length].id,
      })
    }
  }
  return rows
}

export async function isWeeklyRotationEnabled(admin: AdminClient, courseId: string): Promise<boolean> {
  const { count } = await admin.from('grading_groups')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .not('module_id', 'is', null)
  return (count ?? 0) > 0
}

/**
 * (Re)generate every week's groups from the anchor. Wipes existing week rows,
 * including manual per-week tweaks — only used when rotation is first enabled.
 */
export async function generateAllWeeklyGroups(
  admin: AdminClient,
  courseId: string,
): Promise<{ error?: string; weeklyGroups?: Record<string, Record<string, string | null>> }> {
  const ctx = await loadRotationContext(admin, courseId)
  if (ctx.anchorMap.size === 0) return { error: 'Set up base groups first before enabling weekly rotation.' }
  if (ctx.graders.length === 0) return { error: 'No graders found.' }
  if (ctx.modules.length === 0) return { error: 'No modules with assignments found.' }

  await admin.from('grading_groups')
    .delete()
    .eq('course_id', courseId)
    .not('module_id', 'is', null)

  const rows = rotatedRows(ctx, courseId, ctx.modules.map((_, i) => i))
  if (rows.length > 0) {
    const { error } = await admin.from('grading_groups').insert(rows)
    if (error) return { error: error.message }
  }

  const weeklyGroups: Record<string, Record<string, string | null>> = {}
  for (const r of rows) {
    weeklyGroups[r.module_id] ??= {}
    weeklyGroups[r.module_id][r.student_id] = r.grader_id
  }
  return { weeklyGroups }
}

/**
 * Fill in any rotation-eligible week that has no groups yet (e.g. a module
 * published after rotation was turned on). Weeks that already have rows —
 * including manual edits — are left untouched. No-op if rotation is off.
 * Returns the number of weeks filled.
 */
export async function fillMissingWeeklyGroups(admin: AdminClient, courseId: string): Promise<number> {
  if (!await isWeeklyRotationEnabled(admin, courseId)) return 0

  const ctx = await loadRotationContext(admin, courseId)
  if (ctx.graders.length === 0 || ctx.anchorMap.size === 0) return 0

  const existing = await fetchAllRows<{ module_id: string }>((from, to) =>
    admin.from('grading_groups').select('module_id')
      .eq('course_id', courseId).not('module_id', 'is', null).range(from, to)
  )
  const filledModuleIds = new Set(existing.map(r => r.module_id))
  const missingIndexes = ctx.modules
    .map((m, i) => (filledModuleIds.has(m.id) ? -1 : i))
    .filter(i => i !== -1)
  if (missingIndexes.length === 0) return 0

  const rows = rotatedRows(ctx, courseId, missingIndexes)
  if (rows.length > 0) await admin.from('grading_groups').insert(rows)
  return missingIndexes.length
}

/**
 * Keep students' weekly rows in step with base-group changes: students newly
 * unassigned in the base groups are removed from every week; students newly
 * assigned (from unassigned) get their rotated grader in every week. Students
 * who just moved between graders are left alone — their weeks may have been
 * hand-tuned.
 */
export async function syncStudentsWeeklyGroups(
  admin: AdminClient,
  courseId: string,
  { added, removed }: { added: string[]; removed: string[] },
): Promise<void> {
  const changed = [...added, ...removed]
  if (changed.length === 0) return
  if (!await isWeeklyRotationEnabled(admin, courseId)) return

  await admin.from('grading_groups')
    .delete()
    .eq('course_id', courseId)
    .in('student_id', changed)
    .not('module_id', 'is', null)

  if (added.length === 0) return
  const ctx = await loadRotationContext(admin, courseId)
  if (ctx.graders.length === 0) return
  const rows = rotatedRows(ctx, courseId, ctx.modules.map((_, i) => i), added)
  if (rows.length > 0) await admin.from('grading_groups').insert(rows)
}

/** Cron entry point: fill missing weeks for every course that has rotation on. */
export async function fillMissingWeeklyGroupsAllCourses(admin: AdminClient) {
  const weekRows = await fetchAllRows<{ course_id: string }>((from, to) =>
    admin.from('grading_groups').select('course_id').not('module_id', 'is', null).range(from, to)
  )
  const courseIds = [...new Set(weekRows.map(r => r.course_id))]
  const results: Record<string, number> = {}
  for (const courseId of courseIds) {
    results[courseId] = await fillMissingWeeklyGroups(admin, courseId)
  }
  return { courses: courseIds.length, weeksFilled: results }
}
