/**
 * create-test-student.ts
 *
 * Creates a test student account that mirrors a real imported student's data,
 * so you can log in and experience the LMS exactly as a student would.
 *
 * What it copies:
 *   - course_enrollments
 *   - submissions (+ submission_history + submission_comments)
 *   - checklist_responses
 *   - quiz_submissions
 *
 * What it does NOT copy:
 *   - resource_stars / resource_completions (personal bookmarks — not important for testing)
 *   - student_checklist_progress (self-assessment ticks — not important for testing)
 *   - accommodations
 *
 * Usage:
 *   source .env.local && npx ts-node --esm scripts/create-test-student.ts
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── Config ────────────────────────────────────────────────────────────────────

const TEST_EMAIL    = 'catiehart+143@mac.com'
const TEST_PASSWORD = '12345678'
const TEST_NAME     = 'Test Student (Mirror)'

// ── Step 1: Find a good source student ───────────────────────────────────────
// We want someone with a mix of: submitted, graded/complete, graded/incomplete, and some missing.

async function findSourceStudent(): Promise<{ id: string; name: string; email: string }> {
  console.log('\n🔍 Finding a good source student to mirror...')

  // Fetch all students with submissions
  const { data: subs } = await supabase
    .from('submissions')
    .select('student_id, status, grade')

  if (!subs || subs.length === 0) throw new Error('No submissions found in DB')

  // Count statuses per student
  const counts = new Map<string, { submitted: number; complete: number; incomplete: number; total: number }>()
  for (const s of subs) {
    const existing = counts.get(s.student_id) ?? { submitted: 0, complete: 0, incomplete: 0, total: 0 }
    existing.total++
    if (s.status === 'submitted') existing.submitted++
    if (s.status === 'graded' && s.grade === 'complete') existing.complete++
    if (s.status === 'graded' && s.grade === 'incomplete') existing.incomplete++
    counts.set(s.student_id, existing)
  }

  // Score each student: prefer someone with all three categories present
  let bestId = ''
  let bestScore = -1
  for (const [id, c] of counts.entries()) {
    // Must have at least some of each interesting state
    const hasSubmitted  = c.submitted > 0 ? 2 : 0
    const hasComplete   = c.complete  > 0 ? 2 : 0
    const hasIncomplete = c.incomplete > 0 ? 3 : 0  // weight incomplete more — harder to find
    const hasEnough     = c.total >= 5 ? 1 : 0       // enough total submissions to be interesting
    const score = hasSubmitted + hasComplete + hasIncomplete + hasEnough
    if (score > bestScore) {
      bestScore = score
      bestId = id
    }
  }

  if (!bestId) throw new Error('Could not find a suitable source student')

  const { data: user } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('id', bestId)
    .single()

  if (!user) throw new Error(`User row not found for id ${bestId}`)

  const c = counts.get(bestId)!
  console.log(`  Found: ${user.name} (${user.email})`)
  console.log(`  Stats: ${c.submitted} needs-grading · ${c.complete} complete · ${c.incomplete} incomplete · ${c.total} total submissions`)

  return user
}

// ── Step 2: Create or fetch the test auth user ────────────────────────────────

async function upsertTestUser(): Promise<string> {
  console.log(`\n👤 Creating test auth user: ${TEST_EMAIL}`)

  // Check if already exists in auth
  const { data: list } = await supabase.auth.admin.listUsers()
  const existing = list?.users?.find(u => u.email === TEST_EMAIL)

  let authId: string

  if (existing) {
    console.log('  Auth user already exists — updating password')
    await supabase.auth.admin.updateUserById(existing.id, { password: TEST_PASSWORD })
    authId = existing.id
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (error) throw new Error(`Failed to create auth user: ${error.message}`)
    authId = data.user.id
    console.log(`  Auth user created: ${authId}`)
  }

  // Upsert the users table profile
  const { error: profileErr } = await supabase
    .from('users')
    .upsert({ id: authId, email: TEST_EMAIL, name: TEST_NAME, role: 'student' }, { onConflict: 'id' })
  if (profileErr) throw new Error(`Failed to upsert user profile: ${profileErr.message}`)

  return authId
}

// ── Step 3: Copy enrollments ──────────────────────────────────────────────────

async function copyEnrollments(sourceId: string, testId: string) {
  console.log('\n📋 Copying course enrollments...')

  const { data: enrollments } = await supabase
    .from('course_enrollments')
    .select('course_id, role')
    .eq('user_id', sourceId)

  if (!enrollments?.length) {
    console.log('  No enrollments found for source student')
    return
  }

  for (const e of enrollments) {
    const { error } = await supabase
      .from('course_enrollments')
      .upsert({ course_id: e.course_id, user_id: testId, role: e.role }, { onConflict: 'course_id,user_id' })
    if (error) console.warn(`  ⚠ Failed to copy enrollment for course ${e.course_id}: ${error.message}`)
    else console.log(`  ✓ Enrolled in course ${e.course_id} as ${e.role}`)
  }
}

// ── Step 4: Copy submissions ──────────────────────────────────────────────────

async function copySubmissions(sourceId: string, testId: string): Promise<Map<string, string>> {
  console.log('\n📝 Copying submissions...')
  const oldToNew = new Map<string, string>() // old submission id → new submission id

  const { data: subs } = await supabase
    .from('submissions')
    .select('*')
    .eq('student_id', sourceId)

  if (!subs?.length) {
    console.log('  No submissions to copy')
    return oldToNew
  }

  let copied = 0, skipped = 0
  for (const s of subs) {
    // Check if already exists (idempotent re-runs)
    const { data: existing } = await supabase
      .from('submissions')
      .select('id')
      .eq('student_id', testId)
      .eq('assignment_id', s.assignment_id)
      .maybeSingle()

    if (existing) {
      oldToNew.set(s.id, existing.id)
      skipped++
      continue
    }

    const { data: inserted, error } = await supabase
      .from('submissions')
      .insert({
        assignment_id:   s.assignment_id,
        student_id:      testId,
        submission_type: s.submission_type,
        content:         s.content,
        submitted_at:    s.submitted_at,
        status:          s.status,
        grade:           s.grade,
        graded_at:       s.graded_at,
        graded_by:       s.graded_by,
      })
      .select('id')
      .single()

    if (error) { console.warn(`  ⚠ submission for assignment ${s.assignment_id}: ${error.message}`); continue }
    oldToNew.set(s.id, inserted.id)
    copied++
  }

  console.log(`  ✓ ${copied} submissions copied, ${skipped} already existed`)
  return oldToNew
}

// ── Step 5: Copy submission history ──────────────────────────────────────────

async function copySubmissionHistory(sourceId: string, testId: string) {
  console.log('\n📜 Copying submission history...')

  const { data: rows } = await supabase
    .from('submission_history')
    .select('*')
    .eq('student_id', sourceId)

  if (!rows?.length) { console.log('  None to copy'); return }

  let copied = 0
  for (const r of rows) {
    const { error } = await supabase
      .from('submission_history')
      .insert({
        assignment_id:   r.assignment_id,
        student_id:      testId,
        submission_type: r.submission_type,
        content:         r.content,
        submitted_at:    r.submitted_at,
      })
    if (!error) copied++
  }
  console.log(`  ✓ ${copied} history entries copied`)
}

// ── Step 6: Copy submission comments ─────────────────────────────────────────

async function copyComments(sourceId: string, testId: string, oldToNew: Map<string, string>) {
  console.log('\n💬 Copying submission comments...')

  // Get all submission IDs for the source student
  const oldIds = Array.from(oldToNew.keys())
  if (!oldIds.length) { console.log('  No submissions to copy comments for'); return }

  const { data: comments } = await supabase
    .from('submission_comments')
    .select('*')
    .in('submission_id', oldIds)

  if (!comments?.length) { console.log('  No comments to copy'); return }

  let copied = 0
  for (const c of comments) {
    const newSubId = oldToNew.get(c.submission_id)
    if (!newSubId) continue
    const { error } = await supabase
      .from('submission_comments')
      .insert({
        submission_id: newSubId,
        author_id:     c.author_id,
        content:       c.content,
        created_at:    c.created_at,
      })
    if (!error) copied++
  }
  console.log(`  ✓ ${copied} comments copied`)
}

// ── Step 7: Copy checklist responses ─────────────────────────────────────────

async function copyChecklistResponses(sourceId: string, testId: string, oldToNew: Map<string, string>) {
  console.log('\n✅ Copying checklist responses...')

  const oldIds = Array.from(oldToNew.keys())
  if (!oldIds.length) { console.log('  Nothing to copy'); return }

  const { data: rows } = await supabase
    .from('checklist_responses')
    .select('*')
    .in('submission_id', oldIds)

  if (!rows?.length) { console.log('  None to copy'); return }

  let copied = 0
  for (const r of rows) {
    const newSubId = oldToNew.get(r.submission_id)
    if (!newSubId) continue
    const { error } = await supabase
      .from('checklist_responses')
      .upsert({
        submission_id:     newSubId,
        checklist_item_id: r.checklist_item_id,
        checked:           r.checked,
        graded_by:         r.graded_by,
      }, { onConflict: 'submission_id,checklist_item_id' })
    if (!error) copied++
  }
  console.log(`  ✓ ${copied} checklist responses copied`)
}

// ── Step 8: Copy quiz submissions ─────────────────────────────────────────────

async function copyQuizSubmissions(sourceId: string, testId: string) {
  console.log('\n🧪 Copying quiz submissions...')

  const { data: rows } = await supabase
    .from('quiz_submissions')
    .select('*')
    .eq('student_id', sourceId)

  if (!rows?.length) { console.log('  None to copy'); return }

  let copied = 0, skipped = 0
  for (const r of rows) {
    const { error } = await supabase
      .from('quiz_submissions')
      .upsert({
        quiz_id:       r.quiz_id,
        student_id:    testId,
        submitted_at:  r.submitted_at,
        answers:       r.answers,
        score_percent: r.score_percent,
        attempt_count: r.attempt_count,
      }, { onConflict: 'quiz_id,student_id' })
    if (error) skipped++
    else copied++
  }
  console.log(`  ✓ ${copied} quiz submissions copied, ${skipped} skipped`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60))
  console.log('  Test Student Mirror Script')
  console.log('='.repeat(60))

  const source = await findSourceStudent()
  const testId = await upsertTestUser()

  await copyEnrollments(source.id, testId)
  const oldToNew = await copySubmissions(source.id, testId)
  await copySubmissionHistory(source.id, testId)
  await copyComments(source.id, testId, oldToNew)
  await copyChecklistResponses(source.id, testId, oldToNew)
  await copyQuizSubmissions(source.id, testId)

  console.log('\n' + '='.repeat(60))
  console.log('  ✅ Done!')
  console.log('='.repeat(60))
  console.log(`\n  Source student : ${source.name} (${source.email})`)
  console.log(`  Test account   : ${TEST_EMAIL}`)
  console.log(`  Password       : ${TEST_PASSWORD}`)
  console.log(`  \n  Log in at your LMS URL to test the student experience.`)
  console.log(`  To delete this test account later, remove the user from`)
  console.log(`  Supabase Auth > Users and run:`)
  console.log(`    DELETE FROM users WHERE email = '${TEST_EMAIL}';`)
  console.log('')
}

main().catch(err => { console.error('\n❌ Error:', err.message); process.exit(1) })
