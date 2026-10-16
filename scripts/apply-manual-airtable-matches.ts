/**
 * One-off: applies the collision resolutions and confirmed anomaly-guess matches
 * from the manual review round of match-airtable-student-ids.ts, keyed by email
 * (not name) to avoid any ambiguity.
 *
 * Usage:
 *   source .env.local && npx ts-node --esm scripts/apply-manual-airtable-matches.ts
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ASSIGNMENTS: { email: string; code: string; note: string }[] = [
  // Collisions, resolved directly by the user
  { email: 'shannonmartinez358@gmail.com', code: 'S117', note: 'Shannon collision' },
  { email: 'mbelmodis88@gmail.com', code: 'S146', note: 'Mimi collision' },
  { email: 'mimiren015@gmail.com', code: 'S088', note: 'Mimi collision' },
  { email: 'ainsliefrancisdec16@gmail.com', code: 'S089', note: 'Ainslie collision' },
  // Anomaly guesses confirmed by a unique name or email match
  { email: 'cclovepaintings@gmail.com', code: 'S166', note: 'anomaly: Chelsea' },
  { email: 'suzhiatt@gmail.com', code: 'S161', note: 'anomaly: Susan' },
  { email: 'tylan2530@gmail.com', code: 'S165', note: 'anomaly: Genesis' },
  { email: 'lynzet3@gmail.com', code: 'S156', note: 'anomaly: Lynze/Lulu' },
  { email: 'mikellpepper25@gmail.com', code: 'S160', note: 'anomaly: Mikell' },
  { email: 'anjanewhipple@gmail.com', code: 'S149', note: 'anomaly: Anjane' },
  { email: '1461496@gmail.com', code: 'S168', note: 'anomaly: Anastasiia' },
  { email: 'graceprojectsinc@gmail.com', code: 'S164', note: 'anomaly: Grace' },
  { email: 'pses917@gmail.com', code: 'S155', note: 'anomaly: Patrice' },
  { email: 'sufiyahyasmine@gmail.com', code: 'S151', note: 'anomaly: Sufiya/Earth' },
  { email: 'ahusbfs@proton.me', code: 'S159', note: 'anomaly: Amirah' },
  { email: 'godknowyourname@yahoo.com', code: 'S148', note: 'anomaly: Tamela' },
  { email: 'mariew273@gmail.com', code: 'S158', note: 'anomaly: Marie' },
  { email: 'epope1979@gmail.com', code: 'S150', note: 'anomaly: Edriria' },
  { email: 'hedgerace@gmail.com', code: 'S154', note: 'anomaly: Ace' },
  // Round 2 — confirmed directly by the user
  { email: 'jennford1512@gmail.com', code: 'S139', note: 'Jennifer F' },
  { email: 'garceteescarlet@gmail.com', code: 'S142', note: 'Escarlet G' },
  { email: 'jade.s.conley@gmail.com', code: 'S145', note: 'Jade Conley' },
  { email: 'desigro77@gmail.com', code: 'S167', note: 'Ingrid Guerrero (anomaly, verified via currentCourse)' },
]

async function main() {
  for (const a of ASSIGNMENTS) {
    const { data, error } = await supabase
      .from('users')
      .update({ airtable_student_id: a.code })
      .eq('email', a.email)
      .select('id, name, email')

    if (error) {
      console.error(`FAILED ${a.email} -> ${a.code}: ${error.message}`)
      continue
    }
    if (!data?.length) {
      console.error(`NO MATCH for email ${a.email} (${a.note})`)
      continue
    }
    console.log(`OK ${data[0].name} <${a.email}> -> ${a.code} (${a.note})`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
