/**
 * Strips the "Late assignments/ Incomplete Assignments" HTML section
 * from the how_to_turn_in and description fields of all assignments.
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

// Strips any <details>...</details> block whose <summary> contains "Late"
// Also strips standalone divs/sections that include "Late assignments"
function stripLateSection(html: string | null): string | null {
  if (!html) return html;
  // Remove <details> blocks containing "Late assignments"
  let result = html.replace(/<details[\s\S]*?<\/details>/gi, (match) => {
    if (/late\s*assignments/i.test(match)) return "";
    return match;
  });
  // Remove any remaining loose HTML that mentions late assignments (fallback for non-details elements)
  // Look for a block starting with a heading/div containing "Late assignments" through end of content
  result = result.replace(/<[^>]+>[^<]*late\s*assignments[^<]*<\/[^>]+>[\s\S]*/i, (match) => {
    // Only strip if it looks like a boilerplate block (long content)
    if (match.length > 100) return "";
    return match;
  });
  return result.trim() || null;
}

// Fetch all assignments that have the late section in either field
const { data: assignments, error } = await sb
  .from("assignments")
  .select("id, title, how_to_turn_in, description")
  .or("how_to_turn_in.ilike.%Late assignments%,description.ilike.%Late assignments%");

if (error) { console.error("Query failed:", error.message); process.exit(1); }

console.log(`Found ${(assignments ?? []).length} assignments with late-assignment HTML\n`);

let updated = 0;
for (const a of (assignments ?? [])) {
  const newHowTo = stripLateSection(a.how_to_turn_in);
  const newDesc  = stripLateSection(a.description);

  const updates: Record<string, string | null> = {};
  if (newHowTo !== a.how_to_turn_in) updates.how_to_turn_in = newHowTo;
  if (newDesc  !== a.description)    updates.description     = newDesc;

  if (Object.keys(updates).length === 0) {
    console.log(`  ⚠ No change after strip: "${a.title}" (may need manual review)`);
    continue;
  }

  const { error: upErr } = await sb.from("assignments").update(updates).eq("id", a.id);
  if (upErr) {
    console.error(`  ✗ "${a.title}": ${upErr.message}`);
  } else {
    console.log(`  ✓ Stripped from: "${a.title}"`);
    updated++;
  }
}

console.log(`\nDone. Updated ${updated} of ${(assignments ?? []).length} assignments.`);
