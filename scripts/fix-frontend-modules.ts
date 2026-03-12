/**
 * fix-frontend-modules.ts
 *
 * Fixes the Advanced Frontend (Jan 2026) course module titles to match Canvas,
 * then runs assignment refresh from the new JSON.
 *
 * Usage: npx ts-node --esm scripts/fix-frontend-modules.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim(); if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("="); if (idx === -1) continue;
    const k = t.slice(0, idx).trim(), v = t.slice(idx+1).trim().replace(/^["']|["']$/g,"");
    if (!process.env[k]) process.env[k] = v;
  }
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const COURSE_ID = "c4eec58e-43ea-4ef4-a160-27aeb16840db";

console.log("\n════════════════════════════════════════════");
console.log("Fixing Advanced Frontend (Jan 2026) modules");
console.log("════════════════════════════════════════════\n");

// ── 1. Title fixes (match Canvas) ────────────────────────────────────────────
const titleFixes = [
  { from: "Week 8: Logic Games",       to: "Week 8: Assessments & Review" },
  { from: "Week 9: Git Practice & ....?", to: "Week 9: Logic Games & Git Practice" },
];

for (const fix of titleFixes) {
  const { error } = await sb.from("modules")
    .update({ title: fix.to })
    .eq("title", fix.from)
    .eq("course_id", COURSE_ID);
  if (error) {
    console.error(`  ✗ Failed to rename "${fix.from}":`, error.message);
  } else {
    console.log(`  ✓ Renamed: "${fix.from}"\n         → "${fix.to}"`);
  }
}

// ── 2. "Week 9: Logic Games 2" → "OLD Week 9: Logic Games 2", week_number=null
const { data: oldW9, error: oldW9Err } = await sb.from("modules")
  .update({ title: "OLD Week 9: Logic Games 2", week_number: null })
  .eq("title", "Week 9: Logic Games 2")
  .eq("course_id", COURSE_ID)
  .select("id, title");

if (oldW9Err) {
  console.error(`\n  ✗ Failed to rename Week 9 Logic Games 2:`, oldW9Err.message);
} else {
  console.log(`\n  ✓ Renamed "Week 9: Logic Games 2" → "OLD Week 9: Logic Games 2" (week_number=null), ${(oldW9??[]).length} row(s)`);
}

// ── 3. "OTHER ASSIGNMENTS..." week_number=null ────────────────────────────────
const { data: otherMod, error: otherErr } = await sb.from("modules")
  .update({ week_number: null })
  .eq("title", "OTHER ASSIGNMENTS - will figure out what to do with")
  .eq("course_id", COURSE_ID)
  .select("id");

if (otherErr) {
  console.error(`\n  ✗ Failed to update OTHER ASSIGNMENTS:`, otherErr.message);
} else {
  console.log(`  ✓ Set week_number=null on "OTHER ASSIGNMENTS..." module, ${(otherMod??[]).length} row(s)`);
}

console.log("\n════════════════════════════════════════════");
console.log("Module fixes done. Now run:");
console.log("  npx ts-node --esm scripts/refresh-assignments.ts \\");
console.log(`  c4eec58e-43ea-4ef4-a160-27aeb16840db \\`);
console.log("  src/data/frontend/new/advanced-frontend-assignments.json");
console.log("════════════════════════════════════════════\n");
