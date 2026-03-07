import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

type WikiPage = {
  identifier: string;
  title: string;
  content_html?: string;
  body_html?: string;
  module_title: string | null;
};

async function importWikis(filePath: string, courseNameOverride?: string, dayNameOverride?: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const raw = fs.readFileSync(path.resolve(filePath), "utf-8");
  const parsed = JSON.parse(raw);

  // Handle both "wiki_pages" and "wiki" as the array key
  const pages: WikiPage[] = parsed.wiki_pages ?? parsed.wiki ?? [];
  const courseName: string = courseNameOverride ?? parsed.course?.title;

  if (!pages.length) {
    console.log("No wiki pages found in file.");
    return;
  }

  if (!courseName) {
    console.error("No course title found in file.");
    return;
  }

  console.log(`\nImporting wiki pages for: ${courseName}`);

  // 1. Find the course
  let { data: course } = await supabase
    .from("courses")
    .select("id, name")
    .eq("name", courseName)
    .maybeSingle();

  if (!course) {
    const keyword = courseName.split(" ")[0];
    const { data: fuzzy } = await supabase
      .from("courses")
      .select("id, name")
      .ilike("name", `%${keyword}%`);

    if (fuzzy && fuzzy.length >= 1) {
      // Prefer exact case-insensitive match, otherwise take only result
      const lower = courseName.toLowerCase();
      const exact = fuzzy.find((c) => c.name.toLowerCase() === lower);
      course = exact ?? (fuzzy.length === 1 ? fuzzy[0] : null);
      if (course) {
        console.log(`  (matched "${courseName}" → "${course.name}")`);
      }
    }

    if (!course) {
      const { data: all } = await supabase.from("courses").select("name").order("name");
      console.error(`\nCourse not found: "${courseName}"`);
      console.error("Courses in the database:");
      (all ?? []).forEach((c) => console.error(`  - ${c.name}`));
      return;
    }
  }

  console.log(`✓ Found course: ${course.id}`);

  // 2. Skip pages with no module_title
  const assignedPages = pages.filter((p) => p.module_title?.trim());
  const skippedNoModule = pages.length - assignedPages.length;
  if (skippedNoModule > 0) {
    console.log(`  Skipping ${skippedNoModule} page(s) with no module_title`);
  }

  // 3. Group by module_title
  const pagesByModule = new Map<string, WikiPage[]>();
  for (const page of assignedPages) {
    const key = page.module_title!.trim();
    if (!pagesByModule.has(key)) pagesByModule.set(key, []);
    pagesByModule.get(key)!.push(page);
  }

  // 4. Load all existing modules for this course
  const { data: modules } = await supabase
    .from("modules")
    .select("id, title")
    .eq("course_id", course.id);

  const moduleByTitle = new Map((modules ?? []).map((m) => [m.title, m]));

  const { data: allModules } = await supabase
    .from("modules")
    .select("order")
    .eq("course_id", course.id)
    .order("order", { ascending: false })
    .limit(1);

  let nextModuleOrder = (allModules?.[0]?.order ?? -1) + 1;

  let totalImported = 0;
  let totalSkipped = 0;

  for (const [moduleTitle, wikiPages] of pagesByModule) {
    let module = moduleByTitle.get(moduleTitle);

    if (!module) {
      console.log(`  Creating module: "${moduleTitle}"`);
      const { data: newModule, error: modError } = await supabase
        .from("modules")
        .insert({
          course_id: course.id,
          title: moduleTitle,
          week_number: null,
          order: nextModuleOrder++,
        })
        .select("id, title")
        .single();

      if (modError || !newModule) {
        console.error(`  ✗ Failed to create module "${moduleTitle}":`, modError?.message);
        totalSkipped += wikiPages.length;
        continue;
      }

      moduleByTitle.set(moduleTitle, newModule);
      module = newModule;
    }

    console.log(`  Module: ${moduleTitle} (${wikiPages.length} wiki page(s))`);

    // 5. Find or create day for this module
    const targetDayName = dayNameOverride ?? "Wiki";
    const { data: existingDay } = await supabase
      .from("module_days")
      .select("id")
      .eq("module_id", module.id)
      .eq("day_name", targetDayName)
      .maybeSingle();

    let dayId: string;

    if (existingDay) {
      dayId = existingDay.id;
      console.log(`    ↳ Using existing "${targetDayName}" day`);
    } else {
      const { data: allDays } = await supabase
        .from("module_days")
        .select("order")
        .eq("module_id", module.id)
        .order("order", { ascending: false })
        .limit(1);

      const nextOrder = (allDays?.[0]?.order ?? -1) + 1;

      const { data: newDay, error: dayError } = await supabase
        .from("module_days")
        .insert({ module_id: module.id, day_name: targetDayName, order: nextOrder })
        .select("id")
        .single();

      if (dayError || !newDay) {
        console.error(`    ✗ Failed to create "${targetDayName}" day:`, dayError?.message);
        totalSkipped += wikiPages.length;
        continue;
      }

      dayId = newDay.id;
      console.log(`    ↳ Created "${targetDayName}" day`);
    }

    // 6. Check existing resources to avoid duplicates (by title)
    const { data: existing } = await supabase
      .from("resources")
      .select("title")
      .eq("module_day_id", dayId);

    const existingTitles = new Set((existing ?? []).map((r) => r.title));

    const toInsert = wikiPages.filter((p) => !existingTitles.has(p.title));
    const skipped = wikiPages.length - toInsert.length;
    if (skipped > 0) console.log(`    ↳ Skipping ${skipped} already-imported page(s)`);

    if (toInsert.length > 0) {
      const { data: lastResource } = await supabase
        .from("resources")
        .select("order")
        .eq("module_day_id", dayId)
        .order("order", { ascending: false })
        .limit(1);

      const startOrder = (lastResource?.[0]?.order ?? -1) + 1;

      const rows = toInsert.map((page, i) => ({
        module_day_id: dayId,
        type: "reading" as const,
        title: page.title,
        // Handle both content_html and body_html field names
        content: page.content_html ?? page.body_html ?? "",
        order: startOrder + i,
      }));

      const { error: insertError } = await supabase.from("resources").insert(rows);

      if (insertError) {
        console.error(`    ✗ Insert failed:`, insertError.message);
        totalSkipped += toInsert.length;
      } else {
        console.log(`    ✓ Inserted ${rows.length} wiki page(s)`);
        totalImported += rows.length;
      }
    }

    totalSkipped += skipped;
  }

  console.log(`\n✅ Done — ${totalImported} imported, ${totalSkipped} skipped`);
}

const filePath = process.argv[2];
const courseNameOverride = process.argv[3];
const dayNameOverride = process.argv[4];
if (!filePath) {
  console.error('Usage: npx ts-node --esm scripts/import-wikis.ts <path-to-wiki-json> ["Course Name Override"] ["Day Name Override"]');
  process.exit(1);
}

importWikis(filePath, courseNameOverride, dayNameOverride);
