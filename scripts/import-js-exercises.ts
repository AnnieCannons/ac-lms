/**
 * Imports the 12 "JavaScript Exercises for Beginners" assignments
 * into the existing "12 JavaScript Exercises for Beginners" module
 * in the Advanced Frontend course.
 *
 * Run: source .env.local && npx ts-node --esm scripts/import-js-exercises.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim(); if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("="); if (idx === -1) continue;
    const k = t.slice(0, idx).trim(), v = t.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const MODULE_TITLE = "12 JavaScript Exercises for Beginners";
const JSON_FILE = path.resolve(process.cwd(), "src/data/frontend/advanced-frontend-assignments.json");

const raw = JSON.parse(fs.readFileSync(JSON_FILE, "utf-8"));
const exercises = raw.assignments.filter((a: { module_title: string }) => a.module_title === MODULE_TITLE);
console.log(`Found ${exercises.length} exercises in JSON`);

// Find the module in DB by title
const { data: modules, error: modErr } = await sb
  .from("modules")
  .select("id, title, week_number, module_days(id, day_name, order)")
  .ilike("title", MODULE_TITLE);

if (modErr) { console.error("Module lookup failed:", modErr.message); process.exit(1); }
if (!modules?.length) { console.error(`No module found with title "${MODULE_TITLE}"`); process.exit(1); }

console.log(`\nFound ${modules.length} matching module(s):`);
modules.forEach((m: { id: string; title: string; week_number: number | null; module_days: { id: string; day_name: string }[] }) =>
  console.log(`  - "${m.title}" (id: ${m.id}, week: ${m.week_number}, days: ${m.module_days.map((d: { day_name: string }) => d.day_name).join(", ")})`));

const mod = modules[0];
const days: { id: string; day_name: string; order: number }[] = mod.module_days;

// Use "Assignments" day if it exists, otherwise the first day
const targetDay = days.find((d) => d.day_name === "Assignments") ?? days[0];
if (!targetDay) { console.error("Module has no days — add at least one day first"); process.exit(1); }

console.log(`\nInserting into day: "${targetDay.day_name}" (${targetDay.id})`);

// Check for existing assignments in this day to avoid dupes
const { data: existing } = await sb
  .from("assignments")
  .select("title")
  .eq("module_day_id", targetDay.id);

const existingTitles = new Set((existing ?? []).map((a: { title: string }) => a.title.toLowerCase()));
console.log(`  ${existingTitles.size} assignment(s) already in this day`);

let inserted = 0;
let skipped = 0;
for (let i = 0; i < exercises.length; i++) {
  const ex = exercises[i];
  const title = ex.manifest_title || ex.title;
  if (existingTitles.has(title.toLowerCase())) {
    console.log(`  ⚠ Skip (exists): "${title}"`);
    skipped++;
    continue;
  }
  const { error } = await sb.from("assignments").insert({
    module_day_id: targetDay.id,
    title,
    description: ex.description_html || null,
    due_date: null,
    order: (existing?.length ?? 0) + inserted,
    published: false,
  });
  if (error) {
    console.error(`  ✗ "${title}": ${error.message}`);
  } else {
    console.log(`  ✓ Inserted: "${title}"`);
    inserted++;
  }
}

console.log(`\nDone. Inserted ${inserted}, skipped ${skipped} of ${exercises.length} exercises.`);
