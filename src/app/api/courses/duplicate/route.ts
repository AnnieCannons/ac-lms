import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'

export async function POST(req: NextRequest) {
  // Auth check
  const authClient = await createServerSupabaseClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await authClient
    .from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'staff' && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { sourceCourseId, newName, newCode, newStartDate, sourceStartDate, instructorIds } = await req.json()
  if (!sourceCourseId || !newName || !newCode) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  let service: ReturnType<typeof createServiceSupabaseClient>
  try { service = createServiceSupabaseClient() } catch {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
  }

  // The role check above already restricts this route to admins, instructors,
  // and staff — all of whom have global access to duplicate any course.

  // ── FETCH PHASE ──────────────────────────────────────────────────────────
  // Large courses exceed PostgREST's 1000-row response cap (checklist items especially),
  // so every fetch pages through, and long id lists are chunked to keep URLs short.

  type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

  const chunk = <T,>(arr: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, (i + 1) * size))

  async function fetchIn(table: string, column: string, ids: string[], opts: { excludeDeleted?: boolean } = {}): Promise<Row[]> {
    const rows: Row[] = []
    for (const idChunk of chunk(ids, 150)) {
      rows.push(...await fetchAllRows<Row>((from, to) => {
        let q = service.from(table).select('*').in(column, idChunk)
        if (opts.excludeDeleted) q = q.is('deleted_at', null)
        return q.order('id').range(from, to)
      }))
    }
    return rows
  }

  const { data: sourceCourse } = await service
    .from('courses').select('*').eq('id', sourceCourseId).single()
  if (!sourceCourse) return NextResponse.json({ error: 'Source course not found' }, { status: 404 })

  let modules: Row[], days: Row[], assignments: Row[], resources: Row[], checklistItems: Row[]
  let courseSections: Row[], quizzes: Row[], wikis: Row[], assignmentSkills: Row[]
  try {
    modules = await fetchIn('modules', 'course_id', [sourceCourseId], { excludeDeleted: true })
    const moduleIds = modules.map(m => m.id)
    days = await fetchIn('module_days', 'module_id', moduleIds, { excludeDeleted: true })
    const dayIds = days.map(d => d.id)
    ;[assignments, resources, courseSections, quizzes] = await Promise.all([
      fetchIn('assignments', 'module_day_id', dayIds, { excludeDeleted: true }),
      fetchIn('resources', 'module_day_id', dayIds, { excludeDeleted: true }),
      fetchIn('course_sections', 'course_id', [sourceCourseId]),
      fetchIn('quizzes', 'course_id', [sourceCourseId], { excludeDeleted: true }),
    ])
    const assignmentIds = assignments.map(a => a.id)
    const [moduleWikis, dayWikis] = await Promise.all([
      fetchIn('wikis', 'module_id', moduleIds),
      fetchIn('wikis', 'module_day_id', dayIds),
    ])
    wikis = [...new Map([...moduleWikis, ...dayWikis].map(w => [w.id, w])).values()]
    ;[checklistItems, assignmentSkills] = await Promise.all([
      fetchIn('checklist_items', 'assignment_id', assignmentIds),
      fetchIn('confidence_tracker_assignment_skills', 'assignment_id', assignmentIds),
    ])
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  // ── DATE SHIFT ───────────────────────────────────────────────────────────

  let shiftMs = 0
  let datesShifted = false

  // Use explicitly provided sourceStartDate, then fall back to the DB's start_date
  const anchor = sourceStartDate ?? sourceCourse.start_date
  if (anchor && newStartDate) {
    const sourceStart = new Date(anchor + 'T00:00:00Z').getTime()
    const newStart = new Date(newStartDate + 'T00:00:00Z').getTime()
    shiftMs = newStart - sourceStart
    datesShifted = shiftMs !== 0
  }

  function shiftDate(iso: string | null): string | null {
    if (!iso || shiftMs === 0) return iso
    return new Date(new Date(iso).getTime() + shiftMs).toISOString()
  }

  function shiftDateOnly(dateStr: string | null): string | null {
    if (!dateStr || shiftMs === 0) return dateStr
    return new Date(new Date(dateStr.slice(0, 10) + 'T00:00:00Z').getTime() + shiftMs)
      .toISOString().split('T')[0]
  }

  // Assignment due dates are stored as plain YYYY-MM-DD; keep them that way (legacy rows may be timestamps)
  const shiftDueDate = (d: string | null) => (d && d.length === 10 ? shiftDateOnly(d) : shiftDate(d))

  // ── INSERT PHASE ─────────────────────────────────────────────────────────
  // Rows are copied column-for-column (so new columns carry over automatically), minus
  // identity/timestamp columns, with foreign keys remapped to the new course's rows.

  const ROW_META = ['id', 'created_at', 'updated_at']
  const copyRow = (row: Row, overrides: Row, omit: string[] = []): Row => {
    const out: Row = { ...row }
    for (const k of [...ROW_META, ...omit]) delete out[k]
    return { ...out, ...overrides }
  }

  // Inserts in chunks; PostgREST returns inserted rows in input order, which the id maps rely on
  async function insertAll(table: string, rows: Row[]): Promise<Row[]> {
    const inserted: Row[] = []
    for (const rowChunk of chunk(rows, 500)) {
      const { data, error } = await service.from(table).insert(rowChunk).select('id')
      if (error) throw new Error(`${table}: ${error.message}`)
      inserted.push(...(data ?? []))
    }
    return inserted
  }

  const idMap = (source: Row[], inserted: Row[]) =>
    new Map(source.map((r, i) => [r.id as string, inserted[i].id as string]))

  // Course — everything except per-cohort links (Canvas, Airtable attendance) and status flags
  const { data: newCourse, error: courseError } = await service
    .from('courses')
    .insert(copyRow(sourceCourse, {
      name: newName,
      code: newCode,
      start_date: newStartDate ?? sourceCourse.start_date,
      end_date: shiftDateOnly(sourceCourse.end_date),
      archived: false,
      is_template: false,
      canvas_course_id: null,
      airtable_course_name: null,
    }))
    .select().single()

  if (courseError) {
    if (courseError.code === '23505') {
      return NextResponse.json({ error: 'Course code already exists. Please choose a different code.' }, { status: 400 })
    }
    return NextResponse.json({ error: courseError.message }, { status: 500 })
  }

  let stats: Record<string, number>
  try {
    const newModules = await insertAll('modules', modules.map(m => copyRow(m, { course_id: newCourse.id })))
    const moduleIdMap = idMap(modules, newModules)

    const newDays = await insertAll('module_days', days.map(d => copyRow(d, { module_id: moduleIdMap.get(d.module_id)! })))
    const dayIdMap = idMap(days, newDays)

    // Cross-posts (Career Dev → coding course) are remapped when the target day is in this course;
    // links into another course are dropped so the copy doesn't show up in the original's outline
    const remapLinkedDay = (id: string | null) => (id ? dayIdMap.get(id) ?? null : null)

    const newResources = await insertAll('resources', resources.map(r => copyRow(r, {
      module_day_id: dayIdMap.get(r.module_day_id)!,
      linked_day_id: remapLinkedDay(r.linked_day_id),
    })))

    // Grader and Canvas ids are per-cohort, so they start fresh
    const newAssignments = await insertAll('assignments', assignments.map(a => copyRow(a, {
      module_day_id: dayIdMap.get(a.module_day_id)!,
      linked_day_id: remapLinkedDay(a.linked_day_id),
      due_date: shiftDueDate(a.due_date),
      grader_id: null,
      canvas_assignment_id: null,
    })))
    const assignmentIdMap = idMap(assignments, newAssignments)

    const newChecklists = await insertAll('checklist_items', checklistItems.map(ci => copyRow(ci, {
      assignment_id: assignmentIdMap.get(ci.assignment_id)!,
    })))

    await insertAll('confidence_tracker_assignment_skills', assignmentSkills.map(s => copyRow(s, {
      assignment_id: assignmentIdMap.get(s.assignment_id)!,
    })))

    const newSections = await insertAll('course_sections', courseSections.map(cs => copyRow(cs, { course_id: newCourse.id })))

    const newQuizzes = await insertAll('quizzes', quizzes.map(q => copyRow(q, {
      course_id: newCourse.id,
      due_at: shiftDate(q.due_at),
      linked_day_id: remapLinkedDay(q.linked_day_id),
    })))

    const newWikis = await insertAll('wikis', wikis.map(w => copyRow(w, {
      module_id: w.module_id ? moduleIdMap.get(w.module_id) ?? null : null,
      module_day_id: w.module_day_id ? dayIdMap.get(w.module_day_id) ?? null : null,
    })))

    stats = {
      modules: newModules.length,
      days: newDays.length,
      assignments: newAssignments.length,
      resources: newResources.length,
      checklistItems: newChecklists.length,
      sections: newSections.length,
      quizzes: newQuizzes.length,
      wikis: newWikis.length,
    }
  } catch (e) {
    // Don't leave a half-copied course behind; child rows cascade from the course
    await service.from('courses').delete().eq('id', newCourse.id)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  // Instructor enrollments — verify each ID is actually an instructor/admin/staff before enrolling
  const candidateIds: string[] = Array.isArray(instructorIds) ? instructorIds.filter(Boolean) : []
  let validInstructorIds: string[] = []
  if (candidateIds.length > 0) {
    const { data: validUsers } = await service
      .from('users')
      .select('id')
      .in('id', candidateIds)
      .in('role', ['instructor', 'staff', 'admin'])
    validInstructorIds = (validUsers ?? []).map(u => u.id)
  }
  if (validInstructorIds.length > 0) {
    const enrollmentInserts = validInstructorIds.map(id => ({
      course_id: newCourse.id,
      user_id: id,
      role: 'instructor',
    }))
    const { error: enrollError } = await service
      .from('course_enrollments')
      .upsert(enrollmentInserts, { onConflict: 'course_id,user_id' })
    if (enrollError) return NextResponse.json({ error: enrollError.message }, { status: 500 })
  }

  return NextResponse.json({
    newCourseId: newCourse.id,
    stats: { ...stats, datesShifted },
  })
}
