/**
 * debug-canvas-sync.ts
 *
 * Directly tests the Canvas submissions API and DB matching
 * to diagnose why canvas-sync returns 0 submissions.
 *
 * Usage:
 *   source .env.local && npx ts-node --esm scripts/debug-canvas-sync.ts
 *
 * Optional: pass a specific course ID to debug just one course:
 *   source .env.local && npx ts-node --esm scripts/debug-canvas-sync.ts 13609504
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

const COURSE_IDS = process.argv[2]
  ? [process.argv[2]]
  : ['13082263', '13642631', '13609504', '13609741']

const SINCE = '2026-01-01T00:00:00Z'

async function canvasGet(path: string) {
  const url = `${BASE}${path}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
  return { status: res.status, ok: res.ok, body: res.ok ? await res.json() : await res.text(), url }
}

async function main() {
  console.log(`CANVAS_BASE_URL: "${BASE}"`)
  console.log(`CANVAS_API_TOKEN set: ${!!TOKEN}`)
  console.log(`Testing since: ${SINCE}\n`)

  // ── 1. Who is this API token? ─────────────────────────────────────────────
  console.log('=== Token identity ===')
  const self = await canvasGet('/api/v1/users/self/profile')
  if (self.ok) {
    const p = self.body as any
    console.log(`  Name: ${p.name}`)
    console.log(`  Login: ${p.login_id}`)
    console.log(`  Canvas user_id: ${p.id}`)
  } else {
    console.log(`  Failed to get profile: ${self.status}`)
  }

  for (const courseId of COURSE_IDS) {
    console.log(`\n=== Course ${courseId} ===`)

    // Check DB course
    const { data: course } = await supabase
      .from('courses')
      .select('id, name, canvas_course_id')
      .eq('canvas_course_id', courseId)
      .maybeSingle()
    console.log(`  DB course: ${course ? course.name : 'NOT FOUND'}`)
    if (!course) continue

    // ── 2. Try correct endpoint: /students/submissions ─────────────────────
    const r1 = await canvasGet(
      `/api/v1/courses/${courseId}/students/submissions?student_ids[]=all&submitted_since=${encodeURIComponent(SINCE)}&per_page=3`
    )
    console.log(`  [students/submissions + date filter] ${r1.status} — ${r1.ok ? `${(r1.body as any[]).length} results` : 'error'}`)

    // ── 3. Try without date filter ───────────────────────────────────────────
    const r2 = await canvasGet(
      `/api/v1/courses/${courseId}/students/submissions?student_ids[]=all&per_page=3`
    )
    console.log(`  [students/submissions, no date filter] ${r2.status} — ${r2.ok ? `${(r2.body as any[]).length} results` : 'error'}`)

    // ── 4. Old (wrong) endpoint for comparison ──────────────────────────────
    const r3 = await canvasGet(
      `/api/v1/courses/${courseId}/submissions?student_ids[]=all&per_page=3`
    )
    console.log(`  [old /submissions endpoint] ${r3.status} — ${r3.ok ? `${(r3.body as any[]).length} results` : '404 as expected'}`)

    // ── 5. Check the course itself ──────────────────────────────────────────
    const r4 = await canvasGet(`/api/v1/courses/${courseId}`)
    console.log(`  [course lookup] ${r4.status} — ${r4.ok ? (r4.body as any).name : 'not found'}`)

    // ── 6. If any submissions came back, check DB matching ──────────────────
    const subs: any[] = r1.ok ? (r1.body as any[]) : (r2.ok ? (r2.body as any[]) : [])
    for (const s of subs) {
      console.log(`\n  Sub id=${s.id} assignment_id=${s.assignment_id} user_id=${s.user_id} state=${s.workflow_state}`)
      const { data: student } = await supabase.from('users').select('id, name').eq('canvas_user_id', s.user_id).maybeSingle()
      const { data: assignment } = await supabase.from('assignments').select('id, title').eq('canvas_assignment_id', s.assignment_id).maybeSingle()
      console.log(`    Student: ${student ? student.name : `NOT FOUND (canvas_user_id=${s.user_id})`}`)
      console.log(`    Assignment: ${assignment ? assignment.title : `NOT FOUND (canvas_assignment_id=${s.assignment_id})`}`)
    }

    if (!r2.ok && !r3.ok) {
      console.log(`  Raw error body (first 400 chars): ${typeof r2.body === 'string' ? r2.body.slice(0, 400) : JSON.stringify(r2.body).slice(0, 400)}`)
    }
  }

  console.log('\n--- DB counts ---')
  const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).not('canvas_user_id', 'is', null)
  const { count: assignCount } = await supabase.from('assignments').select('*', { count: 'exact', head: true }).not('canvas_assignment_id', 'is', null)
  console.log(`Users with canvas_user_id: ${userCount}`)
  console.log(`Assignments with canvas_assignment_id: ${assignCount}`)
}

main().catch(console.error)
