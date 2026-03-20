/**
 * Canvas → LMS polling sync
 *
 * Called on a schedule (e.g. every 15 minutes via Vercel Cron or cron-job.org).
 * Fetches submissions updated since the last sync for all 4 Canvas courses
 * and upserts them into our DB.
 *
 * Secured by a shared secret: CANVAS_SYNC_SECRET env var.
 *
 * Trigger (GET or POST):
 *   https://your-domain/api/canvas-sync?secret=<CANVAS_SYNC_SECRET>
 *
 * Required env vars:
 *   CANVAS_API_TOKEN
 *   CANVAS_BASE_URL
 *   CANVAS_SYNC_SECRET
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CANVAS_BASE_URL = (process.env.CANVAS_BASE_URL ?? '').replace(/\/$/, '')
const CANVAS_API_TOKEN = process.env.CANVAS_API_TOKEN!
const SYNC_SECRET = process.env.CANVAS_SYNC_SECRET
const CRON_SECRET = process.env.CRON_SECRET

// Canvas course IDs (matches canvas_course_id on our courses table)
const CANVAS_COURSE_IDS = ['13082263', '13642631', '13609504', '13609741']

// How far back to look on the first ever sync (fallback if no last-sync marker)
const INITIAL_LOOKBACK_DAYS = 1

// ── Types ─────────────────────────────────────────────────────────────────────

interface CanvasComment {
  id: number
  author_id: number
  author_name: string
  comment: string
  created_at: string
  edited_at: string | null
}

interface CanvasSubmission {
  id: number
  assignment_id: number
  user_id: number
  workflow_state: string
  grade: string | null
  score: number | null
  submitted_at: string | null
  body: string | null
  url: string | null
  submission_type: string | null
  attachments: { id: number; url: string; filename: string }[]
  submission_comments: CanvasComment[]
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

async function canvasFetch(path: string): Promise<Response> {
  return fetch(`${CANVAS_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${CANVAS_API_TOKEN}` },
  })
}

async function fetchSubmissionsPage(courseId: string, sinceParam: string, since: string): Promise<CanvasSubmission[]> {
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
      console.error(`Canvas API error ${res.status} for course ${courseId} (${sinceParam}) — URL: ${CANVAS_BASE_URL}${url} — Body: ${body.slice(0, 300)}`)
      break
    }
    const page: CanvasSubmission[] = await res.json()
    results.push(...page.filter(s => s.workflow_state !== 'unsubmitted'))

    const link = res.headers.get('Link') ?? ''
    const next = link.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1].replace(CANVAS_BASE_URL, '') : null
  }

  return results
}

async function fetchUpdatedSubmissions(
  courseId: string,
  since: string,
): Promise<CanvasSubmission[]> {
  // Fetch both recently-submitted AND recently-graded submissions, then deduplicate
  const [submitted, graded] = await Promise.all([
    fetchSubmissionsPage(courseId, 'submitted_since', since),
    fetchSubmissionsPage(courseId, 'graded_since', since),
  ])
  // Deduplicate by Canvas submission id — prefer graded over submitted
  // so a submission that was both resubmitted and graded since last sync
  // keeps its graded state rather than the intermediate submitted state.
  const seen = new Set<number>()
  const results: CanvasSubmission[] = []
  for (const s of [...graded, ...submitted]) {
    if (!seen.has(s.id)) { seen.add(s.id); results.push(s) }
  }
  return results
}

// ── Grade mapping ─────────────────────────────────────────────────────────────

function mapGrade(sub: CanvasSubmission): 'complete' | 'incomplete' | null {
  if (sub.workflow_state !== 'graded') return null
  if (sub.grade === 'incomplete') return 'incomplete'
  return 'complete'
}

function mapSubmissionType(sub: CanvasSubmission): 'text' | 'link' {
  if (sub.submission_type === 'online_url') return 'link'
  return 'text'
}

function mapContent(sub: CanvasSubmission): string | null {
  if (sub.submission_type === 'online_upload') return null
  if (sub.submission_type === 'online_url') return sub.url
  return sub.body ?? null
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth check — accepts Vercel's automatic CRON_SECRET header or manual query param
  const authHeader = req.headers.get('authorization')
  const querySecret = req.nextUrl.searchParams.get('secret')
  const validCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`
  const validManual = SYNC_SECRET && querySecret === SYNC_SECRET
  if (!validCron && !validManual) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Optional ?since=<ISO_DATE> and ?until=<ISO_DATE> for manual backfills
  const rawSince = req.nextUrl.searchParams.get('since')
  const rawUntil = req.nextUrl.searchParams.get('until')
  const sinceOverride = rawSince
    ? (rawSince.includes('T') ? rawSince : `${rawSince}T00:00:00Z`)
    : null
  const untilOverride = rawUntil
    ? (rawUntil.includes('T') ? rawUntil : `${rawUntil}T23:59:59Z`)
    : null

  const stats = { submissions: 0, comments: 0, errors: 0 }

  // Pre-fetch all students and assignments once for all courses to avoid per-submission DB round trips
  const [{ data: allStudents }, { data: allAssignments }] = await Promise.all([
    supabase.from('users').select('id, canvas_user_id').not('canvas_user_id', 'is', null),
    supabase.from('assignments').select('id, canvas_assignment_id').not('canvas_assignment_id', 'is', null),
  ])

  const studentMap = new Map<number, string>()
  for (const s of allStudents ?? []) {
    if (s.canvas_user_id) studentMap.set(Number(s.canvas_user_id), s.id)
  }
  const assignmentMap = new Map<number, string>()
  for (const a of allAssignments ?? []) {
    if (a.canvas_assignment_id) assignmentMap.set(Number(a.canvas_assignment_id), a.id)
  }

  for (const canvasCourseId of CANVAS_COURSE_IDS) {
    // Resolve course
    const { data: course } = await supabase
      .from('courses')
      .select('id')
      .eq('canvas_course_id', canvasCourseId)
      .maybeSingle()

    if (!course) continue

    // Determine since timestamp — use a simple key in global_content as a cheap kv store
    const syncKey = `canvas-sync-since-${canvasCourseId}`
    const { data: marker } = await supabase
      .from('global_content')
      .select('content')
      .eq('slug', syncKey)
      .maybeSingle()

    const since = sinceOverride
      ?? marker?.content
      ?? new Date(Date.now() - INITIAL_LOOKBACK_DAYS * 86400 * 1000).toISOString()

    const nowISO = new Date().toISOString()

    // Fetch updated submissions from Canvas
    const canvasSubs = await fetchUpdatedSubmissions(canvasCourseId, since)
    console.log(`Course ${canvasCourseId}: Canvas returned ${canvasSubs.length} submissions`)

    let skippedQuiz = 0, skippedStudent = 0, skippedAssignment = 0, skippedUntil = 0
    for (const cs of canvasSubs) {
      // Skip quizzes
      if (cs.submission_type === 'online_quiz') { skippedQuiz++; continue }

      // Skip submissions outside the until window (for chunked backfills)
      if (untilOverride && cs.submitted_at && cs.submitted_at > untilOverride) { skippedUntil++; continue }

      // Find student via pre-fetched map
      const studentId = studentMap.get(Number(cs.user_id))
      if (!studentId) { skippedStudent++; console.log(`  No student for canvas_user_id=${cs.user_id}`); continue }

      // Find assignment via pre-fetched map
      const assignmentId = assignmentMap.get(Number(cs.assignment_id))
      if (!assignmentId) { skippedAssignment++; console.log(`  No assignment for canvas_assignment_id=${cs.assignment_id}`); continue }

      const grade = mapGrade(cs)
      const status = cs.workflow_state === 'graded' ? 'graded' : 'submitted'

      // Only overwrite grade/graded_at when this submission is graded.
      // A resubmission (workflow_state='submitted') should not wipe out a
      // previously-recorded incomplete/complete grade on the same submission.
      const upsertData: Record<string, unknown> = {
        assignment_id: assignmentId,
        student_id: studentId,
        submission_type: mapSubmissionType(cs),
        content: mapContent(cs),
        submitted_at: cs.submitted_at ?? nowISO,
        status,
      }
      if (status === 'graded') {
        upsertData.grade = grade
        upsertData.graded_at = nowISO
      }

      const { data: upserted, error: subErr } = await supabase
        .from('submissions')
        .upsert(upsertData, { onConflict: 'assignment_id,student_id' })
        .select('id')
        .single()

      if (subErr || !upserted) { stats.errors++; console.log(`  Upsert error: ${subErr?.message}`); continue }
      stats.submissions++

      // Sync comments
      for (const c of cs.submission_comments) {
        const { data: existing } = await supabase
          .from('submission_comments')
          .select('id')
          .eq('submission_id', upserted.id)
          .eq('author_name', c.author_name)
          .eq('created_at', c.created_at)
          .maybeSingle()
        if (existing) continue

        const { error: commentErr } = await supabase
          .from('submission_comments')
          .insert({
            submission_id: upserted.id,
            author_id: null,
            author_name: c.author_name,
            content: c.comment,
            created_at: c.created_at,
          })
        if (!commentErr) stats.comments++
      }
    }

    if (canvasSubs.length > 0) console.log(`Course ${canvasCourseId}: skipped quiz=${skippedQuiz} no-student=${skippedStudent} no-assignment=${skippedAssignment} until-filtered=${skippedUntil}`)

    // Update the since marker to now
    await supabase
      .from('global_content')
      .upsert(
        { slug: syncKey, title: `Canvas sync marker — course ${canvasCourseId}`, content: nowISO, updated_at: nowISO },
        { onConflict: 'slug' },
      )
  }

  return NextResponse.json({ ok: true, ...stats })
}

export const POST = GET
