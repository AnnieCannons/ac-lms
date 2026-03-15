import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const TEST_EMAIL = 'catiehart+143@mac.com'

async function main() {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', TEST_EMAIL)
    .single()

  if (!user) throw new Error('not found')
  console.log('testId:', user.id)

  // Simple: get assignments with their course via module_day → module
  const { data: subs, error } = await supabase
    .from('submissions')
    .select('id, assignment_id, status, grade')
    .eq('student_id', user.id)
    .limit(3)

  console.log('sample subs:', JSON.stringify(subs, null, 2))
  console.log('error:', error)

  // Now try getting assignment → course via join
  const { data: sample, error: e2 } = await supabase
    .from('submissions')
    .select('id, status, grade, assignments(id, module_day_id)')
    .eq('student_id', user.id)
    .limit(2)

  console.log('\nsample with assignments:', JSON.stringify(sample, null, 2))
  console.log('error2:', e2)
}

main().catch(err => { console.error('Error:', err.message); process.exit(1) })
