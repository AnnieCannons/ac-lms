/**
 * refresh-assignments.ts
 *
 * Deletes all assignments (and their test submissions/checklist data) for a
 * given course, then re-imports from a new JSON file.
 *
 * - Existing modules and days are untouched.
 * - Assignments are matched to their module's "Assignments" day by module_title
 *   (exact match first, then week-number fallback).
 * - Assignments with empty module_title go to the existing empty-title module's
 *   "Assignments" day (same behaviour as the original import).
 * - All assignments are imported as published=false — publish via the UI after
 *   verifying the data looks correct.
 *
 * Usage:
 *   source .env.local && npx ts-node --esm scripts/refresh-assignments.ts <courseId> <jsonFile>
 *
 * Example:
 *   source .env.local && npx ts-node --esm scripts/refresh-assignments.ts \
 *     abc123-... src/data/backend/new/advanced-backend-assignments.json
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local if env vars not already set (avoids needing `source .env.local`)
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type AssignmentJSON = {
  identifier: string;
  title: string;
  due_at: string | null;
  grading_type: string;
  submission_types: string;
  description_html: string;
  module_title: string;
  manifest_title: string;
  workflow_state?: string;
};

async function refreshAssignments(courseId: string, filePath: string) {
  const raw = fs.readFileSync(path.resolve(filePath), "utf-8");
  const parsed = JSON.parse(raw);
  const assignments: AssignmentJSON[] = parsed.assignments;

  if (!assignments?.length) {
    console.log("No assignments found in file.");
    return;
  }

  console.log("\n════════════════════════════════════════════");
  console.log(`Course ID : ${courseId}`);
  console.log(`File      : ${filePath}`);
  console.log(`Assignments in JSON: ${assignments.length}`);
  const emptyModuleCount = assignments.filter((a) => !a.module_title?.trim()).length;
  console.log(`  → with module_title : ${assignments.length - emptyModuleCount}`);
  console.log(`  → empty module_title: ${emptyModuleCount} (will go to orphan module)`);
  console.log("════════════════════════════════════════════\n");

  // ── 1. Fetch existing modules for this course ─────────────────────────────
  const { data: modules, error: modulesError } = await supabase
    .from("modules")
    .select("id, title, week_number, order")
    .eq("course_id", courseId)
    .order("order", { ascending: true });

  if (modulesError || !modules) {
    console.error("Failed to fetch modules:", modulesError?.message);
    return;
  }
  console.log(`Found ${modules.length} existing modules.`);

  // ── 2. Fetch all module days for those modules ────────────────────────────
  const moduleIds = modules.map((m) => m.id);
  const { data: days, error: daysError } = await supabase
    .from("module_days")
    .select("id, module_id, day_name")
    .in("module_id", moduleIds);

  if (daysError || !days) {
    console.error("Failed to fetch module days:", daysError?.message);
    return;
  }
  const dayIds = days.map((d) => d.id);

  // ── 3. Fetch existing assignments so we can cascade-delete related records ─
  const { data: existingAssignments } = await supabase
    .from("assignments")
    .select("id")
    .in("module_day_id", dayIds);

  const assignmentIds = (existingAssignments ?? []).map((a) => a.id);
  console.log(`Found ${assignmentIds.length} existing assignments to remove.`);

  if (assignmentIds.length > 0) {
    // Get submission IDs first (needed to delete checklist_responses and comments)
    const { data: existingSubmissions } = await supabase
      .from("submissions")
      .select("id")
      .in("assignment_id", assignmentIds);

    const submissionIds = (existingSubmissions ?? []).map((s) => s.id);

    if (submissionIds.length > 0) {
      console.log(`  Deleting ${submissionIds.length} test submissions + related records...`);

      // checklist_responses → submissions
      await supabase.from("checklist_responses").delete().in("submission_id", submissionIds);
      // submission_comments → submissions
      await supabase.from("submission_comments").delete().in("submission_id", submissionIds);
      // submissions
      const { error: subDelError } = await supabase
        .from("submissions").delete().in("assignment_id", assignmentIds);
      if (subDelError) {
        console.error("  Failed to delete submissions:", subDelError.message);
        return;
      }
    } else {
      console.log("  No submissions to remove.");
    }

    // checklist_items → assignments
    await supabase.from("checklist_items").delete().in("assignment_id", assignmentIds);

    // assignments
    const { error: delError } = await supabase
      .from("assignments").delete().in("module_day_id", dayIds);
    if (delError) {
      console.error("  Failed to delete assignments:", delError.message);
      return;
    }
    console.log("  ✓ All cleared.\n");
  }

  // ── 4. Build module_title → "Assignments" day lookup ─────────────────────
  // Maps exact module title → day id for the "Assignments" day of that module
  const titleToDayId = new Map<string, string>();
  // Also map week_number → day id as fallback
  const weekToDayId = new Map<number, string>();

  for (const mod of modules) {
    const assignDay = days.find(
      (d) => d.module_id === mod.id && d.day_name === "Assignments"
    );
    if (assignDay) {
      if (mod.title?.trim()) titleToDayId.set(mod.title.trim(), assignDay.id);
      if (mod.week_number) weekToDayId.set(mod.week_number, assignDay.id);
    }
  }

  // ── 5. Find the fallback day for empty module_title assignments ───────────
  // Re-use the existing empty-title module (created by the original import).
  const emptyMod = modules.find((m) => !m.title?.trim());
  const fallbackDay = emptyMod
    ? days.find((d) => d.module_id === emptyMod.id && d.day_name === "Assignments")
    : null;

  if (emptyMod && fallbackDay) {
    console.log(`Orphan assignments → module "${emptyMod.title || "(empty title)"}" / day "${fallbackDay.day_name}" (id: ${fallbackDay.id})`);
  } else {
    console.warn("⚠ No empty-title module found for orphan assignments.");
  }

  // ── 6. Insert assignments ─────────────────────────────────────────────────
  console.log("\nInserting assignments...");

  // Group by resolved day so we can assign sequential order per day
  const orderCounter = new Map<string, number>();

  let inserted = 0;
  let failed = 0;
  let orphaned = 0;
  const warnings: string[] = [];

  for (const a of assignments) {
    let dayId: string | null = null;

    if (a.module_title?.trim()) {
      // Exact title match
      dayId = titleToDayId.get(a.module_title.trim()) ?? null;

      if (!dayId) {
        // Week number fallback
        const weekMatch = a.module_title.match(/^Week\s*(\d+)/i);
        if (weekMatch) {
          const weekNum = parseInt(weekMatch[1], 10);
          dayId = weekToDayId.get(weekNum) ?? null;
          if (dayId) {
            warnings.push(`Week-fallback match: "${a.module_title}" → week ${weekNum}`);
          }
        }
      }

      if (!dayId) {
        warnings.push(`No module match for "${a.module_title}" — sent to orphan module`);
        dayId = fallbackDay?.id ?? null;
        orphaned++;
      }
    } else {
      dayId = fallbackDay?.id ?? null;
      orphaned++;
    }

    if (!dayId) {
      console.error(`  ✗ No day found for "${a.title.slice(0, 60)}" — skipped`);
      failed++;
      continue;
    }

    const order = orderCounter.get(dayId) ?? 0;
    orderCounter.set(dayId, order + 1);

    const submissionRequired = a.submission_types !== "none";
    // workflow_state absent in new JSON — default to false; publish via UI after review
    const published = a.workflow_state ? a.workflow_state === "published" : false;

    const { error } = await supabase.from("assignments").insert({
      module_day_id: dayId,
      title: a.title,
      description: a.description_html,
      due_date: a.due_at || null,
      published,
      submission_required: submissionRequired,
      order,
    });

    if (error) {
      console.error(`  ✗ Failed: "${a.title.slice(0, 50)}" — ${error.message}`);
      failed++;
    } else {
      inserted++;
    }
  }

  // ── 7. Summary ────────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════");
  console.log(`✅ Done!`);
  console.log(`   Inserted : ${inserted}`);
  console.log(`   Failed   : ${failed}`);
  console.log(`   Orphaned : ${orphaned} (sent to empty-title module)`);
  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  }
  console.log("\n⚠ All assignments imported as published=false.");
  console.log("  Publish via the Course Editor UI once you've verified the data.");
  console.log("════════════════════════════════════════════\n");
}

// ── CLI entry point ──────────────────────────────────────────────────────────
const [courseId, filePath] = process.argv.slice(2);
if (!courseId || !filePath) {
  console.error(
    "Usage: source .env.local && npx ts-node --esm scripts/refresh-assignments.ts <courseId> <jsonFile>"
  );
  process.exit(1);
}

refreshAssignments(courseId, filePath);
