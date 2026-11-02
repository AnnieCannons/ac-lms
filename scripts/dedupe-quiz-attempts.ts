/**
 * dedupe-quiz-attempts.ts
 *
 * Removes quiz attempts that were recorded by extra clicks on Submit (before 2026-11-02 the button
 * stayed live while saving, and each click counted as a new attempt). Rule: src/lib/quiz-attempts.ts.
 * Covers practice and graded quizzes. For each affected quiz_submissions row it rewrites
 * attempt_history without the duplicates and sets attempt_count to match. The latest answers,
 * score and submitted_at are left alone (a duplicate always has the same score as the attempt it
 * copied). Rows whose attempt_count already disagreed with their history are reported and skipped.
 *
 * Safe to re-run: a second run finds nothing to remove.
 *
 * Usage:
 *   source .env.local && npx ts-node --esm scripts/dedupe-quiz-attempts.ts --dry-run
 *   source .env.local && npx ts-node --esm scripts/dedupe-quiz-attempts.ts
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { dedupeAttemptHistory, type AttemptRecord } from '../src/lib/quiz-attempts.ts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
const DRY_RUN = process.argv.includes('--dry-run')

type Row = {
  id: string
  attempt_count: number | null
  attempt_history: unknown
  quizzes: { title: string | null; is_practice: boolean } | null
}

async function main() {
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('quiz_submissions')
      .select('id, attempt_count, attempt_history, quizzes(title, is_practice)')
      .order('id')
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data as unknown as Row[]))
    if (!data || data.length < 1000) break
  }

  let changed = 0, removed = 0, skipped = 0
  const byKind = { practice: 0, graded: 0 }
  for (const r of rows) {
    const history = Array.isArray(r.attempt_history) ? (r.attempt_history as AttemptRecord[]) : []
    const result = dedupeAttemptHistory(history)
    if (result.removed === 0) continue
    if ((r.attempt_count ?? 0) !== history.length) {
      skipped++
      console.log(`SKIP ${r.id}: attempt_count ${r.attempt_count} != history ${history.length}`)
      continue
    }
    changed++
    removed += result.removed
    byKind[r.quizzes?.is_practice ? 'practice' : 'graded'] += result.removed
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${r.quizzes?.title ?? r.id}: ${history.length} → ${result.history.length} attempts`)
    if (DRY_RUN) continue
    const { error } = await supabase
      .from('quiz_submissions')
      .update({ attempt_history: result.history, attempt_count: result.history.length })
      .eq('id', r.id)
      .eq('attempt_count', history.length) // don't clobber an attempt submitted meanwhile
    if (error) console.error(`  failed: ${error.message}`)
  }

  console.log(`\n${DRY_RUN ? 'Would remove' : 'Removed'} ${removed} duplicate attempts (${byKind.practice} practice, ${byKind.graded} graded) from ${changed} of ${rows.length} submissions; skipped ${skipped}.`)
}

main().catch(e => { console.error(e); process.exit(1) })
