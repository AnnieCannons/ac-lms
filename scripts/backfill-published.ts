import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const JSON_FILES = [
  "src/data/backend/advanced-backend-assignments.json",
  "src/data/frontend/advanced-frontend-assignments.json",
  "src/data/itp/ipt-assignments.json",
  "src/data/tcf/tcf-assignments.json",
];

async function backfill() {
  let totalUnpublished = 0;
  let totalUpdated = 0;

  for (const file of JSON_FILES) {
    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping missing file: ${file}`);
      continue;
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const assignments: { title: string; workflow_state: string }[] = parsed.assignments ?? [];

    const unpublished = assignments.filter((a) => a.workflow_state === "unpublished");
    totalUnpublished += unpublished.length;

    console.log(`\n${file}: ${unpublished.length} unpublished assignments`);

    for (const a of unpublished) {
      const { data, error } = await supabase
        .from("assignments")
        .update({ published: false })
        .eq("title", a.title)
        .select("id");

      if (error) {
        console.error(`  ✗ "${a.title}": ${error.message}`);
      } else {
        const rowCount = data?.length ?? 0;
        console.log(`  ✓ "${a.title}" → unpublished (${rowCount} rows)`);
        totalUpdated += rowCount;
      }
    }
  }

  console.log(`\n✅ Done. ${totalUpdated} assignments marked unpublished (from ${totalUnpublished} in JSON).`);
}

backfill();
