/**
 * canvas-import-students.ts
 *
 * Pulls student rosters from Canvas API for all 4 courses, creates Supabase
 * auth accounts (no email invite sent), and enrolls them in their course.
 *
 * Usage:
 *   source .env.local && npx ts-node --esm scripts/canvas-import-students.ts
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   CANVAS_API_TOKEN       — admin API token
 *   CANVAS_BASE_URL        — e.g. https://canvas.instructure.com
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL!
const CANVAS_API_TOKEN = process.env.CANVAS_API_TOKEN!

// Canvas course ID → our Supabase course lookup key (by canvas_course_id column)
const CANVAS_COURSE_IDS = ['13082263', '13642631', '13609504', '13609741']

// ── Canvas API helpers ────────────────────────────────────────────────────────

interface CanvasUser {
  id: number
  name: string
  login_id: string
  email?: string
  enrollments?: { type: string; enrollment_state: string }[]
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function fetchCanvasStudents(courseId: string): Promise<CanvasUser[]> {
  const students: CanvasUser[] = []
  let url: string | null =
    `${CANVAS_BASE_URL}/api/v1/courses/${courseId}/users` +
    `?enrollment_type[]=student&include[]=email&per_page=100`

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${CANVAS_API_TOKEN}` },
    })
    if (!res.ok) {
      console.error(`Canvas API error for course ${courseId}: ${res.status} ${res.statusText}`)
      break
    }
    const page: CanvasUser[] = await res.json()
    students.push(...page)

    // Follow Canvas pagination (Link header)
    const link = res.headers.get('Link') ?? ''
    const next = link.match(/<([^>]+)>;\s*rel="next"/)
    url = next ? next[1] : null
  }

  return students
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const noEmail: { courseId: string; canvasId: number; name: string; loginId: string }[] = []
  let created = 0
  let skipped = 0
  let enrolled = 0

  for (const canvasCourseId of CANVAS_COURSE_IDS) {
    // Resolve our course by canvas_course_id
    const { data: course } = await supabase
      .from('courses')
      .select('id, name')
      .eq('canvas_course_id', canvasCourseId)
      .maybeSingle()

    if (!course) {
      console.warn(`\n⚠ No course found with canvas_course_id=${canvasCourseId} — skipping.`)
      console.warn(`  (Run the SQL migration and set canvas_course_id on your courses first.)`)
      continue
    }

    console.log(`\n── ${course.name} (Canvas ${canvasCourseId}) ──`)

    const canvasStudents = await fetchCanvasStudents(canvasCourseId)
    console.log(`  Fetched ${canvasStudents.length} students from Canvas`)

    for (const cs of canvasStudents) {
      // Resolve email
      const email =
        cs.email && isEmail(cs.email) ? cs.email.toLowerCase() :
        isEmail(cs.login_id) ? cs.login_id.toLowerCase() :
        null

      if (!email) {
        noEmail.push({ courseId: canvasCourseId, canvasId: cs.id, name: cs.name, loginId: cs.login_id })
        console.log(`  ⚠ No email for ${cs.name} (Canvas ID ${cs.id}, login: ${cs.login_id})`)
        continue
      }

      // Check if user already exists in our users table
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      let userId: string

      if (existing) {
        userId = existing.id
        // Update canvas_user_id if not set
        await supabase
          .from('users')
          .update({ canvas_user_id: cs.id })
          .eq('id', userId)
          .is('canvas_user_id', null)
        skipped++
        console.log(`  → Exists: ${email}`)
      } else {
        // Create auth user — no email invite
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { name: cs.name },
        })
        if (authErr || !authData.user) {
          console.error(`  ✗ Auth create failed for ${email}: ${authErr?.message}`)
          continue
        }
        userId = authData.user.id

        // Create users row
        const { error: userErr } = await supabase.from('users').insert({
          id: userId,
          email,
          name: cs.name,
          role: 'student',
          canvas_user_id: cs.id,
        })
        if (userErr) {
          console.error(`  ✗ users insert failed for ${email}: ${userErr.message}`)
          continue
        }
        created++
        console.log(`  ✓ Created: ${email} (${cs.name})`)
      }

      // Enroll in course (upsert — safe to re-run)
      const { error: enrollErr } = await supabase
        .from('course_enrollments')
        .upsert({ course_id: course.id, user_id: userId, role: 'student' }, { onConflict: 'course_id,user_id' })
      if (enrollErr) {
        console.error(`  ✗ Enrollment failed for ${email}: ${enrollErr.message}`)
      } else {
        enrolled++
      }
    }
  }

  console.log(`\n── Summary ──`)
  console.log(`  Created:  ${created}`)
  console.log(`  Skipped (already existed): ${skipped}`)
  console.log(`  Enrollments upserted: ${enrolled}`)

  if (noEmail.length > 0) {
    console.log(`\n⚠ Students needing manual email entry (${noEmail.length}):`)
    for (const s of noEmail) {
      console.log(`  Canvas course ${s.courseId} | Canvas ID ${s.canvasId} | ${s.name} | login: ${s.loginId}`)
    }
  }
}

run().catch(console.error)
