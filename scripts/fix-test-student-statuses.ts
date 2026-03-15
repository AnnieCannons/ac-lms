/**
 * fix-test-student-statuses.ts
 *
 * Updates a handful of the test student's TCF submissions so the student
 * view shows all interesting states: Turned In and Needs Revision.
 *
 * Usage:
 *   source .env.local && npx ts-node --esm scripts/fix-test-student-statuses.ts
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const TEST_EMAIL  = 'catiehart+143@mac.com'
const TCF_COURSE_ID = '47bf8c60-de2d-4d6d-b5f2-19f3aacac687'

async function main() {
  console.log('='.repeat(60))
  console.log('  Fix Test Student Statuses')
  console.log('='.repeat(60))

  // Get test student ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', TEST_EMAIL)
    .single()
  if (!user) throw new Error(`Test student not found: ${TEST_EMAIL}`)
  const testId = user.id
  console.log(`\nTest student id: ${testId}`)

  // Step 1: Get all assignment IDs in the TCF course
  // assignments → module_days → modules (course_id)
  const { data: modules } = await supabase
    .from('modules')
    .select('id')
    .eq('course_id', TCF_COURSE_ID)
  if (!modules?.length) throw new Error('No modules found for TCF course')
  const moduleIds = modules.map(m => m.id)

  const { data: days } = await supabase
    .from('module_days')
    .select('id')
    .in('module_id', moduleIds)
  if (!days?.length) throw new Error('No days found for TCF course')
  const dayIds = days.map(d => d.id)

  const { data: assignments } = await supabase
    .from('assignments')
    .select('id')
    .in('module_day_id', dayIds)
  if (!assignments?.length) throw new Error('No assignments found for TCF course')
  const tcfAssignmentIds = assignments.map(a => a.id)
  console.log(`TCF course has ${tcfAssignmentIds.length} assignments`)

  // Step 2: Get test student's submissions for TCF assignments
  const { data: subs } = await supabase
    .from('submissions')
    .select('id, assignment_id, status, grade')
    .eq('student_id', testId)
    .in('assignment_id', tcfAssignmentIds)
  if (!subs?.length) throw new Error('No TCF submissions found for test student')

  const byStatus: Record<string, number> = {}
  for (const s of subs) {
    const key = s.grade ? `${s.status}/${s.grade}` : s.status
    byStatus[key] = (byStatus[key] ?? 0) + 1
  }
  console.log(`\nTCF submissions: ${subs.length} total`)
  console.log('Current breakdown:', byStatus)

  // Step 3: Convert 2 "complete" → "Turned In" and 2 → "Needs Revision"
  const completes = subs.filter(s => s.status === 'graded' && s.grade === 'complete')
  if (completes.length < 4) {
    console.log(`\n⚠ Only ${completes.length} complete submissions. Need at least 4. Aborting.`)
    return
  }

  const toTurnedIn     = completes.slice(0, 2)
  const toNeedsRevision = completes.slice(2, 4)

  console.log(`\n→ Converting ${toTurnedIn.length} submissions to "Turned In" (submitted)`)
  for (const s of toTurnedIn) {
    const { error } = await supabase
      .from('submissions')
      .update({ status: 'submitted', grade: null, graded_at: null, graded_by: null })
      .eq('id', s.id)
    if (error) console.warn(`  ⚠ ${s.id}: ${error.message}`)
    else console.log(`  ✓ ${s.id} → submitted`)
  }

  console.log(`\n→ Converting ${toNeedsRevision.length} submissions to "Needs Revision" (graded/incomplete)`)
  for (const s of toNeedsRevision) {
    const { error } = await supabase
      .from('submissions')
      .update({ status: 'graded', grade: 'incomplete' })
      .eq('id', s.id)
    if (error) console.warn(`  ⚠ ${s.id}: ${error.message}`)
    else console.log(`  ✓ ${s.id} → graded/incomplete`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('  ✅ Done!')
  console.log('='.repeat(60))
  console.log(`\n  Log in as: ${TEST_EMAIL}`)
  console.log('  TCF course should now show:')
  console.log('    Turned In:      2')
  console.log('    Needs Revision: 2')
  console.log('')
}

main().catch(err => { console.error('\n❌ Error:', err.message); process.exit(1) })
