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

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL!
const CANVAS_API_TOKEN = process.env.CANVAS_API_TOKEN!
const SYNC_SECRET = process.env.CANVAS_SYNC_SECRET!

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

async function fetchUpdatedSubmissions(
  courseId: string,
  since: string,
): Promise<CanvasSubmission[]> {
  const results: CanvasSubmission[] = []
  let url: string | null =
    `/api/v1/courses/${courseId}/submissions` +
    `?include[]=submission_comments&include[]=attachments` +
    `&submitted_since=${encodeURIComponent(since)}` +
    `&enrollment_type=student&per_page=100`

  while (url) {
    const res = await canvasFetch(url)
    if (!res.ok) {
      console.error(`Canvas API error ${res.status} for course ${courseId}`)
      break
    }
    const page: CanvasSubmission[] = await res.json()
    results.push(...page.filter(s => s.workflow_state !== 'unsubmitted'))

    const link = res.headers.get('Link') ?? ''
    const next = link.match(/<([^>]+)>;\s*rel="next"/)
    // next[1] is the full URL; strip the base for our canvasFetch helper
    url = next ? next[1].replace(CANVAS_BASE_URL, '') : null
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
  // Auth check
  const secret = req.nextUrl.searchParams.get('secret')
  if (!SYNC_SECRET || secret !== SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const stats = { submissions: 0, comments: 0, errors: 0 }

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

    const since = marker?.content
      ?? new Date(Date.now() - INITIAL_LOOKBACK_DAYS * 86400 * 1000).toISOString()

    const nowISO = new Date().toISOString()

    // Fetch updated submissions from Canvas
    const canvasSubs = await fetchUpdatedSubmissions(canvasCourseId, since)

    for (const cs of canvasSubs) {
      // Skip quizzes
      if (cs.submission_type === 'online_quiz') continue

      // Find student
      const { data: student } = await supabase
        .from('users')
        .select('id')
        .eq('canvas_user_id', cs.user_id)
        .maybeSingle()
      if (!student) continue

      // Find assignment by canvas assignment_id — first try a direct lookup,
      // then fall back to title match via a separate Canvas API call if needed.
      // For now: we join via a canvas_assignment_id we store (see note below).
      // We store canvas_assignment_id on assignments to avoid repeated title lookups.
      const { data: assignment } = await supabase
        .from('assignments')
        .select('id')
        .eq('canvas_assignment_id', cs.assignment_id)
        .maybeSingle()
      if (!assignment) continue

      const grade = mapGrade(cs)
      const status = cs.workflow_state === 'graded' ? 'graded' : 'submitted'

      const { data: upserted, error: subErr } = await supabase
        .from('submissions')
        .upsert(
          {
            assignment_id: assignment.id,
            student_id: student.id,
            submission_type: mapSubmissionType(cs),
            content: mapContent(cs),
            submitted_at: cs.submitted_at ?? nowISO,
            status,
            grade,
            graded_at: status === 'graded' ? nowISO : null,
          },
          { onConflict: 'assignment_id,student_id' },
        )
        .select('id')
        .single()

      if (subErr || !upserted) { stats.errors++; continue }
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
