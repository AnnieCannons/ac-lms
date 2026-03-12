/**
 * Adds "Assignments" day to FE Week 1 and moves Week 1 assignments
 * out of the orphan module into their correct home.
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

// Get Week 1 module
const { data: w1 } = await sb.from("modules")
  .select("id")
  .eq("course_id", COURSE_ID)
  .eq("title", "Week 1: Onboarding + Review")
  .single();

if (!w1) { console.error("Week 1 module not found"); process.exit(1); }

// Create the Assignments day
const { data: newDay, error: dayErr } = await sb.from("module_days")
  .insert({ module_id: w1.id, day_name: "Assignments", order: 0 })
  .select("id")
  .single();

if (dayErr || !newDay) { console.error("Failed to create Assignments day:", dayErr?.message); process.exit(1); }
console.log(`✓ Created "Assignments" day for Week 1 (id: ${newDay.id})`);

// Get Week 1 assignment titles from JSON
const raw = JSON.parse(fs.readFileSync("src/data/frontend/new/advanced-frontend-assignments.json", "utf-8"));
const w1Titles = new Set(
  (raw.assignments as any[])
    .filter(a => a.module_title === "Week 1: Onboarding + Review")
    .map(a => a.title as string)
);
console.log(`\nWeek 1 assignments in JSON (${w1Titles.size}):`, [...w1Titles].map(t => `  - ${t}`).join("\n"));

// Find orphan module's Assignments day
const { data: orphanMod } = await sb.from("modules")
  .select("id")
  .eq("course_id", COURSE_ID)
  .eq("title", "")
  .single();

if (!orphanMod) { console.error("Orphan module not found"); process.exit(1); }

const { data: orphanDay } = await sb.from("module_days")
  .select("id")
  .eq("module_id", orphanMod.id)
  .eq("day_name", "Assignments")
  .single();

if (!orphanDay) { console.error("Orphan Assignments day not found"); process.exit(1); }

// Find Week 1 assignments in orphan day by title
const { data: orphanAssignments } = await sb.from("assignments")
  .select("id, title")
  .eq("module_day_id", orphanDay.id)
  .in("title", [...w1Titles]);

console.log(`\nFound ${(orphanAssignments??[]).length} Week 1 assignments in orphan module`);

if ((orphanAssignments??[]).length > 0) {
  const ids = orphanAssignments!.map(a => a.id);
  let order = 0;
  for (const a of orphanAssignments!) {
    const { error } = await sb.from("assignments")
      .update({ module_day_id: newDay.id, order: order++ })
      .eq("id", a.id);
    if (error) console.error(`  ✗ "${a.title}": ${error.message}`);
    else console.log(`  ✓ Moved: "${a.title}"`);
  }
}

console.log("\nDone.");
