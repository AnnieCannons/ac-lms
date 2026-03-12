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

const { data: modules } = await sb.from("modules").select("id, title, week_number").eq("course_id", COURSE_ID).order("order");
console.log(`Modules: ${(modules??[]).length}`);
const moduleIds = (modules ?? []).map((m: any) => m.id);

const { data: days } = await sb.from("module_days").select("id, module_id, day_name").in("module_id", moduleIds);
console.log(`Days: ${(days??[]).length}`);
const dayIds = (days ?? []).map((d: any) => d.id);

const { data: resources, error } = await sb.from("resources").select("id, title, module_day_id").in("module_day_id", dayIds);
console.log(`Resources: ${(resources??[]).length}`, error?.message ?? "");

// Also: search by title for known backend resources
const { data: byTitle } = await sb.from("resources").select("id, title, module_day_id").ilike("title", "%Version%");
console.log(`\nResources with 'Version' in title:`);
for (const r of byTitle ?? []) {
  // find which day/module
  const d = (days ?? []).find(d => d.id === r.module_day_id);
  const m = d ? (modules ?? []).find(m => m.id === d.module_id) : null;
  console.log(`  "${r.title}" → day: ${d?.day_name ?? "UNKNOWN"} → module: ${m?.title ?? "OTHER COURSE"}`);
}
