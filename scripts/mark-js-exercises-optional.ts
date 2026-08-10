/**
 * Marks the 12 "Exercise N" assignments in the "12 JavaScript Exercises for
 * Beginners" module (Advanced Frontend) as is_optional=true — students only
 * need to submit 3 of the 12, so the rest shouldn't count as Not Started/Missing.
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

const { data: modules, error: modErr } = await sb
  .from("modules")
  .select("id, title, course_id")
  .ilike("title", "%12 JavaScript Exercises for Beginners%");
if (modErr) { console.error(modErr.message); process.exit(1); }
if (!modules || modules.length === 0) { console.error("Module not found"); process.exit(1); }
console.log(`Found ${modules.length} module(s):`, modules.map(m => `${m.title} (${m.id})`));

const moduleIds = modules.map(m => m.id);
const { data: days, error: dayErr } = await sb
  .from("module_days")
  .select("id, day_name, module_id")
  .in("module_id", moduleIds);
if (dayErr) { console.error(dayErr.message); process.exit(1); }

const dayIds = (days ?? []).map(d => d.id);
const { data: assignments, error: aErr } = await sb
  .from("assignments")
  .select("id, title, is_optional")
  .in("module_day_id", dayIds)
  .ilike("title", "Exercise%");
if (aErr) { console.error(aErr.message); process.exit(1); }

console.log(`Found ${assignments?.length ?? 0} exercise assignments:`);
for (const a of assignments ?? []) console.log(`  - ${a.title} (is_optional=${a.is_optional})`);

const idsToUpdate = (assignments ?? []).filter(a => !a.is_optional).map(a => a.id);
if (idsToUpdate.length === 0) {
  console.log("All exercises already marked optional. Nothing to do.");
  process.exit(0);
}

const { error: updateErr } = await sb.from("assignments").update({ is_optional: true }).in("id", idsToUpdate);
if (updateErr) { console.error("Update failed:", updateErr.message); process.exit(1); }

console.log(`Marked ${idsToUpdate.length} assignment(s) as is_optional=true.`);
