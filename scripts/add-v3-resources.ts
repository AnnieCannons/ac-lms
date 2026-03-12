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

const v3Resources = [
  {
    title: "Version 3 Instructions — Countries App",
    content: "https://github.com/ac-backend/countries-app-instructions/tree/main/version-3",
    type: "link",
  },
  {
    title: "Version 3 API Documentation — Countries App",
    content: "https://github.com/ac-backend/countries-app-instructions/blob/main/version-3/api-documentation.md",
    type: "link",
  },
];

// Get weeks 10 and 11
const { data: modules } = await sb.from("modules")
  .select("id, title, week_number")
  .eq("course_id", COURSE_ID)
  .in("week_number", [10, 11]);

for (const mod of (modules ?? []).sort((a: any, b: any) => a.week_number - b.week_number)) {
  const { data: days } = await sb.from("module_days")
    .select("id, day_name")
    .eq("module_id", mod.id)
    .eq("day_name", "Resources")
    .single();

  if (!days) {
    console.error(`  ✗ No Resources day found for ${mod.title}`);
    continue;
  }

  // Get current max order for this day
  const { data: existing } = await sb.from("resources")
    .select("order")
    .eq("module_day_id", days.id)
    .order("order", { ascending: false })
    .limit(1);

  let order = ((existing ?? [])[0]?.order ?? -1) + 1;

  console.log(`\nAdding to ${mod.title}:`);
  for (const r of v3Resources) {
    const { error } = await sb.from("resources").insert({
      module_day_id: days.id,
      title: r.title,
      content: r.content,
      type: r.type,
      order: order++,
    });
    if (error) {
      console.error(`  ✗ "${r.title}": ${error.message}`);
    } else {
      console.log(`  ✓ "${r.title}"`);
    }
  }
}

console.log("\nDone.");
