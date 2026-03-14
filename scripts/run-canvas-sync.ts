/**
 * run-canvas-sync.ts
 *
 * Runs the Canvas → LMS submission sync locally (no Vercel timeout).
 * Same logic as /api/canvas-sync but runs as a script.
 *
 * Usage:
 *   source .env.local && npx ts-node --esm scripts/run-canvas-sync.ts
 *
 * Optional: pass a since date to backfill:
 *   source .env.local && npx ts-node --esm scripts/run-canvas-sync.ts 2026-01-01
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const BASE = (process.env.CANVAS_BASE_URL ?? '').replace(/\/$/, '')
const TOKEN = process.env.CANVAS_API_TOKEN!
const COURSE_IDS = ['13082263', '13642631', '13609504', '13609741']
const INITIAL_LOOKBACK_DAYS = 1

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Normalize date-only strings to full ISO datetime Canvas requires
const rawSince = process.argv[2] ?? null
const sinceOverride = rawSince
  ? (rawSince.includes('T') ? rawSince : `${rawSince}T00:00:00Z`)
  : null

interface CanvasComment {
  author_name: string
  comment: string
  created_at: string
}

interface CanvasSubmission {
  id: number
  assignment_id: number
  user_id: number
  workflow_state: string
  grade: string | null
  submitted_at: string | null
  body: string | null
  url: string | null
  submission_type: string | null
  submission_comments: CanvasComment[]
}

async function canvasFetch(path: string) {
  return fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } })
}

async function fetchPage(courseId: string, sinceParam: string, since: string): Promise<CanvasSubmission[]> {
  const results: CanvasSubmission[] = []
  let url: string | null =
    `/api/v1/courses/${courseId}/students/submissions` +
    `?student_ids[]=all` +
    `&include[]=submission_comments&include[]=attachments` +
    `&${sinceParam}=${encodeURIComponent(since)}` +
    `&per_page=100`

  while (url) {
    const res = await canvasFetch(url)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error(`  Canvas ${res.status} for course ${courseId} (${sinceParam}): ${body.slice(0, 200)}`)
      break
    }
    const page: CanvasSubmission[] = await res.json()
    results.push(...page.filter(s => s.workflow_state !== 'unsubmitted'))
    const next = (res.headers.get('Link') ?? '').match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1].replace(BASE, '') : null
  }
  return results
}

function mapGrade(s: CanvasSubmission): 'complete' | 'incomplete' | null {
  if (s.workflow_state !== 'graded') return null
  if (s.grade === 'incomplete') return 'incomplete'
  return 'complete'
}

async function main() {
  const stats = { submissions: 0, comments: 0, errors: 0 }

  for (const courseId of COURSE_IDS) {
    const { data: course } = await supabase.from('courses').select('id').eq('canvas_course_id', courseId).maybeSingle()
    if (!course) { console.log(`Course ${courseId}: not in DB, skipping`); continue }

    const syncKey = `canvas-sync-since-${courseId}`
    const { data: marker } = await supabase.from('global_content').select('content').eq('slug', syncKey).maybeSingle()

    const since = sinceOverride
      ?? marker?.content
      ?? new Date(Date.now() - INITIAL_LOOKBACK_DAYS * 86400 * 1000).toISOString()

    console.log(`\nCourse ${courseId}: syncing since ${since}`)

    const nowISO = new Date().toISOString()

    // Fetch submitted_since and graded_since, deduplicate
    const [submitted, graded] = await Promise.all([
      fetchPage(courseId, 'submitted_since', since),
      fetchPage(courseId, 'graded_since', since),
    ])
    const seen = new Set<number>()
    const canvasSubs: CanvasSubmission[] = []
    for (const s of [...submitted, ...graded]) {
      if (!seen.has(s.id)) { seen.add(s.id); canvasSubs.push(s) }
    }
    console.log(`  Canvas returned ${canvasSubs.length} submissions`)

    let skippedQuiz = 0, skippedStudent = 0, skippedAssignment = 0
    for (const cs of canvasSubs) {
      if (cs.submission_type === 'online_quiz') { skippedQuiz++; continue }

      const { data: student } = await supabase.from('users').select('id').eq('canvas_user_id', cs.user_id).maybeSingle()
      if (!student) { skippedStudent++; continue }

      const { data: assignment } = await supabase.from('assignments').select('id').eq('canvas_assignment_id', cs.assignment_id).maybeSingle()
      if (!assignment) { skippedAssignment++; continue }

      const grade = mapGrade(cs)
      const status = cs.workflow_state === 'graded' ? 'graded' : 'submitted'
      const submissionType = cs.submission_type === 'online_url' ? 'link' : 'text'
      const content = cs.submission_type === 'online_upload' ? null : cs.submission_type === 'online_url' ? cs.url : cs.body ?? null

      const { data: upserted, error: subErr } = await supabase
        .from('submissions')
        .upsert(
          { assignment_id: assignment.id, student_id: student.id, submission_type: submissionType, content, submitted_at: cs.submitted_at ?? nowISO, status, grade, graded_at: status === 'graded' ? nowISO : null },
          { onConflict: 'assignment_id,student_id' },
        )
        .select('id')
        .single()

      if (subErr || !upserted) { stats.errors++; console.log(`  Upsert error: ${subErr?.message}`); continue }
      stats.submissions++

      for (const c of cs.submission_comments) {
        const { data: existing } = await supabase.from('submission_comments').select('id').eq('submission_id', upserted.id).eq('author_name', c.author_name).eq('created_at', c.created_at).maybeSingle()
        if (existing) continue
        const { error: commentErr } = await supabase.from('submission_comments').insert({ submission_id: upserted.id, author_id: null, author_name: c.author_name, content: c.comment, created_at: c.created_at })
        if (!commentErr) stats.comments++
      }
    }

    console.log(`  Skipped: quiz=${skippedQuiz} no-student=${skippedStudent} no-assignment=${skippedAssignment}`)

    await supabase.from('global_content').upsert(
      { slug: syncKey, title: `Canvas sync marker — course ${courseId}`, content: nowISO, updated_at: nowISO },
      { onConflict: 'slug' },
    )
  }

  console.log(`\nDone. submissions=${stats.submissions} comments=${stats.comments} errors=${stats.errors}`)
}

main().catch(console.error)
