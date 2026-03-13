/**
 * Moves the 89 orphaned (empty module_title) assignments back out of Week 2's
 * Assignments day and into the orphan module's Assignments day where they belong.
 * Keeps legitimate Week 2 assignments in place.
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

// Load the JSON to know which titles are legitimate Week 2 assignments
const raw = JSON.parse(fs.readFileSync("src/data/frontend/new/advanced-frontend-assignments.json", "utf-8"));
const w2Titles = new Set(
  (raw.assignments as any[])
    .filter(a => a.module_title === "Week 2: Dot/Bracket + If/else")
    .map(a => a.title as string)
);
console.log(`Legitimate Week 2 assignment titles (${w2Titles.size}):`, [...w2Titles]);

// Get Week 2 modules
const { data: w2mods } = await sb.from("modules")
  .select("id, title").eq("course_id", COURSE_ID).eq("week_number", 2);

const orphanMod = (w2mods ?? []).find((m: any) => !m.title?.trim());
const realMod   = (w2mods ?? []).find((m: any) =>  m.title?.trim());
if (!orphanMod || !realMod) { console.error("Modules not found"); process.exit(1); }

// Get the Assignments days for both
const { data: realAssignDay } = await sb.from("module_days").select("id")
  .eq("module_id", realMod.id).eq("day_name", "Assignments").single();
const { data: orphanAssignDay } = await sb.from("module_days").select("id")
  .eq("module_id", orphanMod.id).eq("day_name", "Assignments").single();

if (!realAssignDay || !orphanAssignDay) { console.error("Days not found"); process.exit(1); }

// Get all assignments currently in real Week 2's Assignments day
const { data: allInReal } = await sb.from("assignments")
  .select("id, title").eq("module_day_id", realAssignDay.id);

// Split: keep legitimate Week 2 ones, move the rest back to orphan
const toKeep = (allInReal ?? []).filter((a: any) => w2Titles.has(a.title));
const toMove = (allInReal ?? []).filter((a: any) => !w2Titles.has(a.title));

console.log(`\nAssignments in real Week 2 Assignments: ${(allInReal??[]).length}`);
console.log(`  Keep (legitimate Week 2): ${toKeep.length}`);
console.log(`  Move back to orphan: ${toMove.length}`);

if (toMove.length > 0) {
  // Get current count in orphan for ordering
  const { count: orphanCount } = await sb.from("assignments")
    .select("*", { count: "exact", head: true }).eq("module_day_id", orphanAssignDay.id);

  const ids = toMove.map((a: any) => a.id);
  const { error } = await sb.from("assignments")
    .update({ module_day_id: orphanAssignDay.id })
    .in("id", ids);

  if (error) console.error("Failed:", error.message);
  else console.log(`\n✓ Moved ${toMove.length} assignments back to orphan module.`);
}

// Fix order on kept assignments
for (let i = 0; i < toKeep.length; i++) {
  await sb.from("assignments").update({ order: i }).eq("id", (toKeep[i] as any).id);
}
console.log(`✓ ${toKeep.length} Week 2 assignments remain in Week 2 Assignments day.`);
console.log("\nDone.");
