/**
 * seed-readiness-test.ts
 *
 * Test harness for the student-accountability readiness score + escalation
 * feature (src/lib/readiness.ts). Creates one isolated test course + test
 * student — never touches real courses or real students — then lets you
 * fast-forward through fake weeks by hitting the *real* cron HTTP routes
 * (readiness-score, escalation-reminders), so it exercises the actual code
 * path rather than a mocked one.
 *
 * Since real courses are all inactive during the break (isCurrentCourse()
 * requires today to fall within start_date/end_date), this test course is
 * the *only* course the cron will process while you're testing — no risk of
 * it touching real students.
 *
 * Requires the dev server running (npm run dev) at BASE_URL.
 *
 * Usage:
 *   source .env.local && npx ts-node --esm scripts/seed-readiness-test.ts setup
 *   npx ts-node --esm scripts/seed-readiness-test.ts week --missing=6 --revision=4 --asOf=2026-09-07
 *   npx ts-node --esm scripts/seed-readiness-test.ts status
 *   npx ts-node --esm scripts/seed-readiness-test.ts teardown
 *
 * Required env vars (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   CRON_SECRET
 * Optional:
 *   BASE_URL (default http://localhost:3000)
 *
 * `week` walks one fake Monday. --asOf must land on a Monday (any Monday,
 * real or fake) since that's what getWeekRanges() keys off of; the readiness
 * job scores the Mon-Thu *before* that date. --missing/--revision (out of a
 * fixed pool of 10 test assignments) control that week's backlog -- omit
 * them to re-score with whatever the pool is currently set to. Attendance is
 * always 0% missed in this harness (the test course has no airtable_course_name),
 * so every score here is purely backlog-driven -- see computeReadinessScore
 * in src/lib/readiness.ts if you also want to test the attendance term.
 *
 * Scoring is STEPPED (floor division), not continuous: 1 pt off per full 3
 * missing, 1 pt off per full 2 needs-revision, 1 pt off per full 12% missed.
 * E.g. missing=2 costs nothing; missing=3 costs 1 point.
 *
 * Example full walk (red -> grace -> reset), one command per fake Monday.
 * missing+revision must be <= 10 (the fixed test-assignment pool size):
 *   week --missing=6 --revision=4 --asOf=2026-09-07   # score 1, red    -> triggers step1
 *   week --missing=3 --revision=2 --asOf=2026-09-14   # score 3, yellow -> progress, grace week (stays step1)
 *   week --missing=0 --revision=0 --asOf=2026-09-21   # score 5, green  -> 1st good week
 *   week --asOf=2026-09-28                            # score 5, green  -> 2nd good week -> resets
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET

const TEST_EMAIL = 'catiehart+readiness@mac.com'
const TEST_PASSWORD = '12345678'
const TEST_NAME = 'Readiness Test Student'
const TEST_COURSE_NAME = 'Backend (Readiness Test)' // must contain a track keyword -- detectTrack() looks for "backend"
const NUM_TEST_ASSIGNMENTS = 10

// ── Lookups ──────────────────────────────────────────────────────────────────

async function getTestCourseId(): Promise<string> {
  const { data } = await supabase.from('courses').select('id').eq('name', TEST_COURSE_NAME).maybeSingle()
  if (!data) throw new Error(`Test course not found -- run "setup" first`)
  return data.id
}

async function getTestStudentId(): Promise<string> {
  const { data } = await supabase.from('users').select('id').eq('email', TEST_EMAIL).maybeSingle()
  if (!data) throw new Error(`Test student not found -- run "setup" first`)
  return data.id
}

async function getTestAssignmentIds(courseId: string): Promise<string[]> {
  const { data: days } = await supabase
    .from('module_days')
    .select('id, modules!inner(course_id)')
    .eq('modules.course_id', courseId)
  const dayIds = (days ?? []).map(d => d.id)
  if (dayIds.length === 0) return []

  const { data: assignments } = await supabase
    .from('assignments')
    .select('id, title')
    .in('module_day_id', dayIds)
    .like('title', 'Readiness Test Assignment %')
    .order('title', { ascending: true })

  return (assignments ?? []).map(a => a.id)
}

// ── setup ────────────────────────────────────────────────────────────────────

async function setup() {
  console.log('Setting up readiness test fixtures...\n')

  // Test course, dated to safely bracket "today" (real today, not any fake asOf).
  const start = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  const end = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10)

  let { data: course } = await supabase.from('courses').select('id').eq('name', TEST_COURSE_NAME).maybeSingle()
  if (!course) {
    const { data: inserted, error } = await supabase
      .from('courses')
      .insert({ name: TEST_COURSE_NAME, code: 'READINESS-TEST', start_date: start, end_date: end, is_template: false, archived: false, airtable_course_name: null })
      .select('id')
      .single()
    if (error) throw new Error(`Failed to create test course: ${error.message}`)
    course = inserted
    console.log(`✓ Created test course (${course.id})`)
  } else {
    // Keep the date window fresh on re-runs.
    await supabase.from('courses').update({ start_date: start, end_date: end, archived: false }).eq('id', course.id)
    console.log(`✓ Test course already exists (${course.id})`)
  }
  const courseId = course.id

  let { data: module_ } = await supabase.from('modules').select('id').eq('course_id', courseId).eq('title', 'Readiness Test Module').maybeSingle()
  if (!module_) {
    const { data: inserted, error } = await supabase
      .from('modules')
      .insert({ course_id: courseId, title: 'Readiness Test Module', order: 1, category: 'syllabus', published: true })
      .select('id')
      .single()
    if (error) throw new Error(`Failed to create test module: ${error.message}`)
    module_ = inserted
    console.log(`✓ Created test module (${module_.id})`)
  } else {
    console.log(`✓ Test module already exists (${module_.id})`)
  }

  let { data: day } = await supabase.from('module_days').select('id').eq('module_id', module_.id).eq('day_name', 'Assignments').maybeSingle()
  if (!day) {
    const { data: inserted, error } = await supabase
      .from('module_days')
      .insert({ module_id: module_.id, day_name: 'Assignments', order: 1 })
      .select('id')
      .single()
    if (error) throw new Error(`Failed to create test module day: ${error.message}`)
    day = inserted
    console.log(`✓ Created test module day (${day.id})`)
  } else {
    console.log(`✓ Test module day already exists (${day.id})`)
  }

  const pastDue = new Date(Date.now() - 3 * 86400_000).toISOString()
  for (let i = 1; i <= NUM_TEST_ASSIGNMENTS; i++) {
    const title = `Readiness Test Assignment ${i}`
    const { data: existing } = await supabase.from('assignments').select('id').eq('module_day_id', day.id).eq('title', title).maybeSingle()
    if (!existing) {
      const { error } = await supabase.from('assignments').insert({
        module_day_id: day.id, title, due_date: pastDue, published: true, submission_required: true,
      })
      if (error) console.warn(`  ⚠ assignment ${i}: ${error.message}`)
    }
  }
  console.log(`✓ ${NUM_TEST_ASSIGNMENTS} test assignments ready`)

  // Test student.
  const { data: list } = await supabase.auth.admin.listUsers()
  const existingAuth = list?.users?.find(u => u.email === TEST_EMAIL)
  let studentId: string
  if (existingAuth) {
    await supabase.auth.admin.updateUserById(existingAuth.id, { password: TEST_PASSWORD })
    studentId = existingAuth.id
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email: TEST_EMAIL, password: TEST_PASSWORD, email_confirm: true })
    if (error) throw new Error(`Failed to create test auth user: ${error.message}`)
    studentId = data.user.id
  }
  await supabase.from('users').upsert({ id: studentId, email: TEST_EMAIL, name: TEST_NAME, role: 'student' }, { onConflict: 'id' })
  await supabase.from('course_enrollments').upsert({ course_id: courseId, user_id: studentId, role: 'student' }, { onConflict: 'course_id,user_id' })
  console.log(`✓ Test student ready (${studentId}) -- log in with ${TEST_EMAIL} / ${TEST_PASSWORD}`)

  console.log('\nSetup complete. Next: run "week --missing=<n> --revision=<n> --asOf=<YYYY-MM-DD>"')
}

// ── week ─────────────────────────────────────────────────────────────────────

async function setBacklog(missing: number, revision: number) {
  const courseId = await getTestCourseId()
  const studentId = await getTestStudentId()
  const assignmentIds = await getTestAssignmentIds(courseId)
  if (assignmentIds.length < missing + revision) {
    throw new Error(`Only ${assignmentIds.length} test assignments exist -- missing+revision must be <= that`)
  }

  const missingIds = assignmentIds.slice(0, missing)
  const revisionIds = assignmentIds.slice(missing, missing + revision)
  const completeIds = assignmentIds.slice(missing + revision)

  // Missing = no submission row at all.
  if (missingIds.length > 0) {
    await supabase.from('submissions').delete().eq('student_id', studentId).in('assignment_id', missingIds)
  }
  for (const assignment_id of revisionIds) {
    await supabase.from('submissions').upsert(
      { assignment_id, student_id: studentId, status: 'graded', grade: 'incomplete', submission_type: 'text', content: 'test' },
      { onConflict: 'assignment_id,student_id' },
    )
  }
  for (const assignment_id of completeIds) {
    await supabase.from('submissions').upsert(
      { assignment_id, student_id: studentId, status: 'graded', grade: 'complete', submission_type: 'text', content: 'test' },
      { onConflict: 'assignment_id,student_id' },
    )
  }

  console.log(`✓ Backlog set: ${missing} missing, ${revision} needs-revision, ${completeIds.length} complete`)
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

async function callCron(path: string, params: Record<string, string>) {
  if (!CRON_SECRET) throw new Error('CRON_SECRET not set in .env.local')
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${BASE_URL}${path}?${qs}`, { headers: { Authorization: `Bearer ${CRON_SECRET}` } })
  const json = await res.json()
  console.log(`  ${path}?${qs} ->`, JSON.stringify(json))
  return json
}

async function week(args: Record<string, string>) {
  if (args.missing !== undefined || args.revision !== undefined) {
    await setBacklog(Number(args.missing ?? 0), Number(args.revision ?? 0))
  }
  const asOf = args.asOf
  if (!asOf) throw new Error('week requires --asOf=YYYY-MM-DD (should be a Monday)')

  // courseId is always passed so this can never touch a real, currently-active
  // course even if one happens to be in session (as one was during initial testing).
  const courseId = await getTestCourseId()

  console.log(`\nRunning readiness-score for asOf=${asOf} (scoped to test course only)...`)
  await callCron('/api/cron/readiness-score', { force: 'true', asOf, courseId })

  console.log(`Running escalation-reminders (cutoffHours=0, bypasses the real 48h wait)...`)
  await callCron('/api/cron/escalation-reminders', { cutoffHours: '0', courseId })

  await status()
}

// ── status ───────────────────────────────────────────────────────────────────

async function status() {
  const courseId = await getTestCourseId()
  const studentId = await getTestStudentId()

  const { data: snapshots } = await supabase
    .from('student_stats_snapshots')
    .select('week_start, missing_count, needs_revision_count, attendance_pct_missed, readiness_score')
    .eq('student_id', studentId).eq('course_id', courseId)
    .order('week_start', { ascending: true })

  console.log('\n--- Weekly snapshots ---')
  for (const s of snapshots ?? []) {
    console.log(`  ${s.week_start}: score=${s.readiness_score?.toFixed(2)}  missing=${s.missing_count}  revision=${s.needs_revision_count}  attendance_missed=${s.attendance_pct_missed}%`)
  }

  const { data: state } = await supabase
    .from('escalation_states')
    .select('*')
    .eq('student_id', studentId).eq('course_id', courseId)
    .maybeSingle()

  console.log('\n--- Escalation state ---')
  console.log(state ? JSON.stringify(state, null, 2) : '  (none)')

  const { data: events } = await supabase
    .from('escalation_events')
    .select('week_start, event_type, score, note, created_at')
    .eq('student_id', studentId).eq('course_id', courseId)
    .order('created_at', { ascending: true })

  console.log('\n--- Escalation events ---')
  for (const e of events ?? []) {
    console.log(`  [${e.week_start ?? '—'}] ${e.event_type}${e.score != null ? ` (score ${Number(e.score).toFixed(2)})` : ''}${e.note ? ` -- ${e.note}` : ''}`)
  }

  const { data: checkins } = await supabase
    .from('accountability_checkins')
    .select('form_type, note, goals, reflection, obstacles, submitted_at')
    .eq('student_id', studentId).eq('course_id', courseId)
    .order('submitted_at', { ascending: true })

  console.log('\n--- Check-in submissions ---')
  for (const c of checkins ?? []) {
    console.log(`  [${c.submitted_at}] ${c.form_type}: ${JSON.stringify({ note: c.note, goals: c.goals, reflection: c.reflection, obstacles: c.obstacles })}`)
  }
  console.log('')
}

// ── teardown ─────────────────────────────────────────────────────────────────

async function teardown() {
  const { data: course } = await supabase.from('courses').select('id').eq('name', TEST_COURSE_NAME).maybeSingle()
  if (course) {
    // Cascades to modules/module_days/assignments/enrollments/submissions/
    // student_stats_snapshots/escalation_states/escalation_events (all FK
    // ON DELETE CASCADE on course_id).
    const { error } = await supabase.from('courses').delete().eq('id', course.id)
    if (error) console.warn(`  ⚠ Failed to delete test course: ${error.message}`)
    else console.log(`✓ Deleted test course and all dependent rows`)
  } else {
    console.log('  No test course found')
  }

  const { data: list } = await supabase.auth.admin.listUsers()
  const existingAuth = list?.users?.find(u => u.email === TEST_EMAIL)
  if (existingAuth) {
    await supabase.auth.admin.deleteUser(existingAuth.id)
    console.log(`✓ Deleted test student auth account`)
  }
  // Deleting the auth user does not cascade to the public.users row -- remove
  // it explicitly, or a later setup's createUser fails on the unique email
  // constraint via the auth-user-created trigger.
  const { error: userDeleteErr } = await supabase.from('users').delete().eq('email', TEST_EMAIL)
  if (userDeleteErr) console.warn(`  ⚠ Failed to delete orphaned users row: ${userDeleteErr.message}`)
  else console.log(`✓ Deleted test student users row`)

  console.log('\nTeardown complete.')
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  const args = parseArgs(rest)

  switch (cmd) {
    case 'setup': return setup()
    case 'week': return week(args)
    case 'status': return status()
    case 'teardown': return teardown()
    default:
      console.log('Usage: seed-readiness-test.ts <setup|week|status|teardown> [--missing=N --revision=N --asOf=YYYY-MM-DD]')
      process.exit(1)
  }
}

main().catch(err => { console.error('\n❌ Error:', err.message); process.exit(1) })
