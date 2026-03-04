import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Auth check
  const authClient = await createServerSupabaseClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await authClient
    .from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'instructor' && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { sourceCourseId, newName, newCode, newStartDate, sourceStartDate } = await req.json()
  if (!sourceCourseId || !newName || !newCode) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  let service: ReturnType<typeof createServiceSupabaseClient>
  try { service = createServiceSupabaseClient() } catch {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
  }

  // ── FETCH PHASE ──────────────────────────────────────────────────────────

  const { data: sourceCourse } = await service
    .from('courses').select('*').eq('id', sourceCourseId).single()
  if (!sourceCourse) return NextResponse.json({ error: 'Source course not found' }, { status: 404 })

  const { data: modules } = await service
    .from('modules').select('*').eq('course_id', sourceCourseId).order('order')

  const moduleIds = (modules ?? []).map(m => m.id)
  const { data: days } = moduleIds.length
    ? await service.from('module_days').select('*').in('module_id', moduleIds).order('order')
    : { data: [] }

  const dayIds = (days ?? []).map(d => d.id)
  const [{ data: assignments }, { data: resources }] = dayIds.length
    ? await Promise.all([
        service.from('assignments').select('*').in('module_day_id', dayIds),
        service.from('resources').select('*').in('module_day_id', dayIds).order('order'),
      ])
    : [{ data: [] }, { data: [] }]

  const assignmentIds = (assignments ?? []).map(a => a.id)
  const [{ data: checklistItems }, { data: courseSections }] = await Promise.all([
    assignmentIds.length
      ? service.from('checklist_items').select('*').in('assignment_id', assignmentIds).order('order')
      : Promise.resolve({ data: [] }),
    service.from('course_sections').select('*').eq('course_id', sourceCourseId).order('order'),
  ])

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
    return new Date(new Date(dateStr + 'T00:00:00Z').getTime() + shiftMs)
      .toISOString().split('T')[0]
  }

  // ── INSERT PHASE ─────────────────────────────────────────────────────────

  // Course
  const { data: newCourse, error: courseError } = await service
    .from('courses')
    .insert({
      name: newName,
      code: newCode,
      syllabus_content: sourceCourse.syllabus_content,
      start_date: newStartDate ?? sourceCourse.start_date,
      end_date: shiftDateOnly(sourceCourse.end_date),
    })
    .select().single()

  if (courseError) {
    if (courseError.code === '23505') {
      return NextResponse.json({ error: 'Course code already exists. Please choose a different code.' }, { status: 400 })
    }
    return NextResponse.json({ error: courseError.message }, { status: 500 })
  }

  // Modules
  const moduleInserts = (modules ?? []).map(m => ({
    course_id: newCourse.id,
    title: m.title,
    week_number: m.week_number,
    order: m.order,
  }))
  const { data: newModules, error: modulesError } = moduleInserts.length
    ? await service.from('modules').insert(moduleInserts).select()
    : { data: [], error: null }
  if (modulesError) return NextResponse.json({ error: modulesError.message }, { status: 500 })

  const moduleIdMap = new Map<string, string>()
  ;(modules ?? []).forEach((m, i) => moduleIdMap.set(m.id, newModules![i].id))

  // Days
  const dayInserts = (days ?? []).map(d => ({
    module_id: moduleIdMap.get(d.module_id)!,
    day_name: d.day_name,
    order: d.order,
  }))
  const { data: newDays, error: daysError } = dayInserts.length
    ? await service.from('module_days').insert(dayInserts).select()
    : { data: [], error: null }
  if (daysError) return NextResponse.json({ error: daysError.message }, { status: 500 })

  const dayIdMap = new Map<string, string>()
  ;(days ?? []).forEach((d, i) => dayIdMap.set(d.id, newDays![i].id))

  // Resources
  const resourceInserts = (resources ?? []).map(r => ({
    module_day_id: dayIdMap.get(r.module_day_id)!,
    type: r.type,
    title: r.title,
    content: r.content,
    order: r.order,
  }))
  const { data: newResources, error: resourcesError } = resourceInserts.length
    ? await service.from('resources').insert(resourceInserts).select()
    : { data: [], error: null }
  if (resourcesError) return NextResponse.json({ error: resourcesError.message }, { status: 500 })

  // Assignments
  const assignmentInserts = (assignments ?? []).map(a => ({
    module_day_id: dayIdMap.get(a.module_day_id)!,
    title: a.title,
    description: a.description,
    how_to_turn_in: a.how_to_turn_in,
    due_date: shiftDate(a.due_date),
    published: a.published,
  }))
  const { data: newAssignments, error: assignmentsError } = assignmentInserts.length
    ? await service.from('assignments').insert(assignmentInserts).select()
    : { data: [], error: null }
  if (assignmentsError) return NextResponse.json({ error: assignmentsError.message }, { status: 500 })

  const assignmentIdMap = new Map<string, string>()
  ;(assignments ?? []).forEach((a, i) => assignmentIdMap.set(a.id, newAssignments![i].id))

  // Checklist items
  const checklistInserts = (checklistItems ?? []).map(ci => ({
    assignment_id: assignmentIdMap.get(ci.assignment_id)!,
    text: ci.text,
    description: ci.description,
    order: ci.order,
  }))
  const { data: newChecklists, error: checklistError } = checklistInserts.length
    ? await service.from('checklist_items').insert(checklistInserts).select()
    : { data: [], error: null }
  if (checklistError) return NextResponse.json({ error: checklistError.message }, { status: 500 })

  // Course sections
  const sectionInserts = (courseSections ?? []).map(s => ({
    course_id: newCourse.id,
    title: s.title,
    content: s.content,
    order: s.order,
  }))
  const { data: newSections, error: sectionsError } = sectionInserts.length
    ? await service.from('course_sections').insert(sectionInserts).select()
    : { data: [], error: null }
  if (sectionsError) return NextResponse.json({ error: sectionsError.message }, { status: 500 })

  return NextResponse.json({
    newCourseId: newCourse.id,
    stats: {
      modules: newModules?.length ?? 0,
      days: newDays?.length ?? 0,
      assignments: newAssignments?.length ?? 0,
      resources: newResources?.length ?? 0,
      checklistItems: newChecklists?.length ?? 0,
      sections: newSections?.length ?? 0,
      datesShifted,
    },
  })
}
