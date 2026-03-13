/**
 * canvas-import-submissions.ts
 *
 * Reads the 4 Canvas student-data JSON files and imports historical submissions
 * + instructor comments into our LMS database.
 *
 * Rules:
 *  - Skip `unsubmitted` (workflow_state = 'unsubmitted')
 *  - Skip quizzes (submission_type = 'online_quiz')
 *  - File uploads (online_upload): mark grade=complete, content=null
 *  - grade=null + workflow_state=graded → treat as complete
 *  - Comments: store with author_name (no user FK needed)
 *  - Safe to re-run: upserts on (assignment_id, student_id)
 *
 * Usage:
 *   npx ts-node --esm scripts/canvas-import-submissions.ts
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

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
  user_id: number
  user_name: string
  submitted_at: string | null
  grade: string | null
  score: number | null
  workflow_state: string
  body: string | null
  url: string | null
  submission_type: string | null
  attachments: { id: number; display_name: string; url: string; filename: string }[]
  submission_comments: CanvasComment[]
  assignment_name: string
}

interface CanvasAssignment {
  id: number
  name: string
  due_at: string | null
  submission_types: string[]
  submissions: CanvasSubmission[]
}

interface DataFile {
  course_id: string
  assignments: CanvasAssignment[]
}

const DATA_FILES = [
  'src/data/tcf/tcf-student-data.json',
  'src/data/backend/advanced-backend-student-data.json',
  'src/data/frontend/advanced-frontend-student-data.json',
  'src/data/itp/itp-student-data.json',
]

// ── Grade mapping ─────────────────────────────────────────────────────────────

function mapGrade(sub: CanvasSubmission): 'complete' | 'incomplete' | null {
  if (sub.workflow_state !== 'graded') return null
  if (sub.grade === 'incomplete') return 'incomplete'
  // complete, numeric scores, null grade when graded → all treated as complete
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  let submissionsImported = 0
  let submissionsSkipped = 0
  let commentsImported = 0
  let assignmentsNotFound: string[] = []

  for (const relPath of DATA_FILES) {
    const filePath = path.resolve(relPath)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data: DataFile = JSON.parse(raw)

    // Resolve our course by canvas_course_id
    const { data: course } = await supabase
      .from('courses')
      .select('id, name')
      .eq('canvas_course_id', data.course_id)
      .maybeSingle()

    if (!course) {
      console.warn(`\n⚠ No course found with canvas_course_id=${data.course_id} — skipping ${relPath}`)
      continue
    }

    console.log(`\n── ${course.name} (${data.assignments.length} assignments) ──`)

    // Pre-fetch all assignments for this course into a title → id map
    const { data: moduleRows } = await supabase
      .from('modules')
      .select('module_days(assignments!module_day_id(id, title))')
      .eq('course_id', course.id)

    const assignmentMap = new Map<string, string>()
    for (const m of moduleRows ?? []) {
      const days = (m.module_days ?? []) as { assignments: { id: string; title: string }[] }[]
      for (const d of days) {
        for (const a of d.assignments ?? []) {
          if (a.title) assignmentMap.set(a.title.trim().toLowerCase(), a.id)
        }
      }
    }

    for (const ca of data.assignments) {
      // Skip quiz assignments entirely
      if (ca.submission_types.includes('online_quiz')) continue

      // Find matching assignment within this course only
      const assignment = assignmentMap.get(ca.name.trim().toLowerCase())
        ? { id: assignmentMap.get(ca.name.trim().toLowerCase())! }
        : null

      if (!assignment) {
        if (!assignmentsNotFound.includes(ca.name)) {
          assignmentsNotFound.push(ca.name)
        }
        continue
      }

      process.stdout.write(`  ✓ "${ca.name.trim()}" ... `)

      // Backfill canvas_assignment_id for live sync matching
      await supabase
        .from('assignments')
        .update({ canvas_assignment_id: ca.id })
        .eq('id', assignment.id)
        .is('canvas_assignment_id', null)

      for (const sub of ca.submissions) {
        // Skip unsubmitted
        if (sub.workflow_state === 'unsubmitted') {
          submissionsSkipped++
          continue
        }

        // Find student by canvas_user_id
        const { data: student } = await supabase
          .from('users')
          .select('id')
          .eq('canvas_user_id', sub.user_id)
          .maybeSingle()

        if (!student) {
          console.log(`  ⚠ Student not found for Canvas user_id ${sub.user_id} (${sub.user_name})`)
          submissionsSkipped++
          continue
        }

        const grade = mapGrade(sub)
        const status = sub.workflow_state === 'graded' ? 'graded' : 'submitted'
        const submissionType = mapSubmissionType(sub)
        const content = mapContent(sub)

        // Upsert submission
        // Check if submission already exists
        // When submitted_at is null (instructor-graded without submission), use
        // 1 day before due date so it doesn't appear late. Fall back to now().
        const submittedAt = sub.submitted_at
          ?? (ca.due_at ? new Date(new Date(ca.due_at).getTime() - 86400000).toISOString() : new Date().toISOString())

        const { data: existing } = await supabase
          .from('submissions')
          .select('id')
          .eq('assignment_id', assignment.id)
          .eq('student_id', student.id)
          .maybeSingle()

        let submissionId: string
        if (existing) {
          // Update in place
          const { error: updErr } = await supabase
            .from('submissions')
            .update({ submission_type: submissionType, content, status, grade,
              submitted_at: submittedAt,
              graded_at: status === 'graded' ? submittedAt : null,
            })
            .eq('id', existing.id)
          if (updErr) { console.error(`  ✗ Submission update failed: ${updErr.message}`); submissionsSkipped++; continue }
          submissionId = existing.id
        } else {
          const { data: inserted, error: insErr } = await supabase
            .from('submissions')
            .insert({ assignment_id: assignment.id, student_id: student.id,
              submission_type: submissionType, content, status, grade,
              submitted_at: submittedAt,
              graded_at: status === 'graded' ? submittedAt : null,
            })
            .select('id').single()
          if (insErr || !inserted) { console.error(`  ✗ Submission insert failed: ${insErr?.message}`); submissionsSkipped++; continue }
          submissionId = inserted.id
        }

        const upserted = { id: submissionId }

        submissionsImported++

        // Import comments (skip if already exist — check by submission_id + author_name + created_at)
        for (const c of sub.submission_comments) {
          const { data: existingComment } = await supabase
            .from('submission_comments')
            .select('id')
            .eq('submission_id', upserted.id)
            .eq('author_name', c.author_name)
            .eq('created_at', c.created_at)
            .maybeSingle()

          if (existingComment) continue

          const { error: commentErr } = await supabase
            .from('submission_comments')
            .insert({
              submission_id: upserted.id,
              author_id: null,
              author_name: c.author_name,
              content: c.comment,
              created_at: c.created_at,
            })

          if (commentErr) {
            console.error(`  ✗ Comment insert failed: ${commentErr.message}`)
          } else {
            commentsImported++
          }
        }
      }
    }
  }

  console.log(`\n── Summary ──`)
  console.log(`  Submissions imported: ${submissionsImported}`)
  console.log(`  Submissions skipped:  ${submissionsSkipped}`)
  console.log(`  Comments imported:    ${commentsImported}`)
  if (assignmentsNotFound.length > 0) {
    console.log(`\n  Assignments not matched (${assignmentsNotFound.length}):`)
    assignmentsNotFound.forEach(n => console.log(`    - ${n}`))
  }
}

run().catch(console.error)
