/**
 * fix-backend-modules.ts
 *
 * Fixes the Advanced Backend (Jan 2026) course:
 *  1. Renames Week 11 and Week 12 module titles to match Canvas
 *  2. Sets Week 7 Career Week's week_number to null (no numbered week)
 *  3. Deletes Version 4 resources that are incorrectly in weeks 10 & 11
 *     (Version 4 resources belong only in week 12 per Canvas)
 *
 * NOTE: Version 3 resources for weeks 10 & 11 must be added manually via UI.
 *
 * Usage: npx ts-node --esm scripts/fix-backend-modules.ts
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
const COURSE_ID = "52a9e81a-ba00-496a-bea8-99143ec55400";

console.log("\n════════════════════════════════════════════");
console.log("Fixing Advanced Backend (Jan 2026) modules");
console.log("════════════════════════════════════════════\n");

// ── 1. Fix module titles ──────────────────────────────────────────────────────

const titleFixes = [
  {
    from: "Week 11: Countries App Version 4",
    to:   "Week 11: Countries App Version 3 & Assessments",
  },
  {
    from: "Week 12: Countries App Version 4 and Assessments",
    to:   "Week 12: Countries App Version 3",
  },
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

// ── 2. Null out week_number for "Week 7: Career Week" ─────────────────────────

const { data: careerWeekMod, error: cwError } = await sb.from("modules")
  .update({ week_number: null })
  .eq("title", "Week 7: Career Week")
  .eq("course_id", COURSE_ID)
  .select("id, title");

if (cwError) {
  console.error(`\n  ✗ Failed to update Week 7 Career Week:`, cwError.message);
} else {
  console.log(`\n  ✓ Set week_number=null on ${(careerWeekMod ?? []).length} "Week 7: Career Week" module(s)`);
}

// ── 3. Delete wrong Version 4 resources from weeks 10 & 11 ───────────────────

// Get modules for weeks 10 and 11
const { data: wrongModules } = await sb.from("modules")
  .select("id, title")
  .eq("course_id", COURSE_ID)
  .in("week_number", [10, 11]);

const wrongModuleIds = (wrongModules ?? []).map((m: any) => m.id);

const { data: wrongDays } = await sb.from("module_days")
  .select("id, module_id, day_name")
  .in("module_id", wrongModuleIds);

const wrongDayIds = (wrongDays ?? []).map((d: any) => d.id);

// Find Version 4 resources in these weeks
const { data: wrongResources } = await sb.from("resources")
  .select("id, title, module_day_id")
  .in("module_day_id", wrongDayIds)
  .or("title.ilike.%Version 4%");

if ((wrongResources ?? []).length === 0) {
  console.log("\n  (No Version 4 resources found in weeks 10-11 to remove)");
} else {
  console.log(`\n  Deleting ${wrongResources!.length} Version 4 resource(s) from weeks 10-11:`);
  for (const r of wrongResources!) {
    const day = wrongDays!.find(d => d.id === r.module_day_id);
    const mod = wrongModules!.find(m => m.id === day?.module_id);
    console.log(`    - "${r.title}" (${mod?.title} / ${day?.day_name})`);
  }

  const { error: delError } = await sb.from("resources")
    .delete()
    .in("id", wrongResources!.map(r => r.id));

  if (delError) {
    console.error("  ✗ Delete failed:", delError.message);
  } else {
    console.log("  ✓ Deleted.");
  }
}

console.log("\n════════════════════════════════════════════");
console.log("Done!");
console.log("\n⚠ NEXT STEPS (manual via UI):");
console.log("  Add to Week 10 (Node, Express, SQL, and APIs) / Resources day:");
console.log("    - Version 3 Instructions — Countries App");
console.log("    - Version 3 API Documentation — Countries App");
console.log("  Add to Week 11 (Countries App Version 3 & Assessments) / Resources day:");
console.log("    - Version 3 Instructions — Countries App");
console.log("    - Version 3 API Documentation — Countries App");
console.log("  (Get URLs from Canvas weeks 10-11)");
console.log("════════════════════════════════════════════\n");
