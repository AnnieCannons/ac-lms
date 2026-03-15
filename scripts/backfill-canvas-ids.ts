/**
 * backfill-canvas-ids.ts
 *
 * For each Canvas course, fetches assignments and students from Canvas API
 * and sets canvas_assignment_id / canvas_user_id in our DB by matching on
 * title (assignments) and email (students).
 *
 * Safe to re-run.
 *
 * Usage:
 *   source .env.local && npx ts-node --esm scripts/backfill-canvas-ids.ts
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
const BASE = (process.env.CANVAS_BASE_URL ?? '').replace(/\/$/, '')
const TOKEN = process.env.CANVAS_API_TOKEN!
const COURSE_IDS = ['13082263', '13642631', '13609504', '13609741']

async function pages<T>(path: string): Promise<T[]> {
  const out: T[] = []
  let url: string | null = `${BASE}${path}`
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
    if (!res.ok) { console.error(`Canvas ${res.status} ${url}`); break }
    out.push(...(await res.json() as T[]))
    const m = (res.headers.get('Link') ?? '').match(/<([^>]+)>;\s*rel="next"/)
    url = m ? m[1] : null
  }
  return out
}

async function main() {
  for (const canvasCourseId of COURSE_IDS) {
    console.log(`\n=== Course ${canvasCourseId} ===`)

    const { data: course } = await supabase
      .from('courses').select('id, name').eq('canvas_course_id', canvasCourseId).maybeSingle()
    if (!course) { console.log('  Not in DB, skipping'); continue }
    console.log(`  ${course.name}`)

    // ── Load all our DB assignments for this course ──────────────────────────
    const { data: dbAssignments } = await supabase
      .from('assignments')
      .select('id, title, canvas_assignment_id, module_day_id')

    // Get all module_day_ids that belong to this course
    const { data: modules } = await supabase
      .from('modules').select('id').eq('course_id', course.id)
    const moduleIds = new Set((modules ?? []).map(m => m.id))

    const { data: moduleDays } = await supabase
      .from('module_days').select('id, module_id').in('module_id', [...moduleIds])
    const dayIds = new Set((moduleDays ?? []).map(d => d.id))

    // Build title → assignment map for this course only
    const byTitle = new Map<string, string>() // normalizedTitle → assignment.id
    for (const a of (dbAssignments ?? [])) {
      if (dayIds.has(a.module_day_id)) {
        byTitle.set(a.title.trim().toLowerCase(), a.id)
      }
    }
    console.log(`  DB has ${byTitle.size} assignments for this course`)

    // ── Canvas assignments ───────────────────────────────────────────────────
    const canvasAssignments = await pages<{ id: number; name: string }>(
      `/api/v1/courses/${canvasCourseId}/assignments?per_page=100`
    )
    console.log(`  Canvas has ${canvasAssignments.length} assignments`)

    let aUpdated = 0, aNoMatch = 0
    for (const ca of canvasAssignments) {
      const key = ca.name.trim().toLowerCase()
      const dbId = byTitle.get(key)
      if (!dbId) { aNoMatch++; continue }
      const { error } = await supabase
        .from('assignments').update({ canvas_assignment_id: ca.id }).eq('id', dbId)
      if (!error) aUpdated++
    }
    console.log(`  Assignments: linked=${aUpdated} unmatched=${aNoMatch}`)

    // ── Canvas students ──────────────────────────────────────────────────────
    const canvasStudents = await pages<{ id: number; email?: string; login_id?: string }>(
      `/api/v1/courses/${canvasCourseId}/users?enrollment_type[]=student&include[]=email&per_page=100`
    )
    console.log(`  Canvas has ${canvasStudents.length} students`)

    let sUpdated = 0, sNoMatch = 0
    for (const cs of canvasStudents) {
      const email = (cs.email || cs.login_id || '').toLowerCase().trim()
      if (!email) { sNoMatch++; continue }
      const { data: user } = await supabase
        .from('users').select('id, canvas_user_id').ilike('email', email).maybeSingle()
      if (!user) { sNoMatch++; console.log(`    No user for ${email}`); continue }
      if (user.canvas_user_id === cs.id) continue
      const { error } = await supabase
        .from('users').update({ canvas_user_id: cs.id }).eq('id', user.id)
      if (!error) sUpdated++
    }
    console.log(`  Students: linked=${sUpdated} unmatched=${sNoMatch}`)
  }
  console.log('\nDone.')
}

main()
