import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

type LinkJSON = {
  identifier: string;
  title: string;
  url: string;
  module_title: string;
  manifest_title: string;
};

async function importLinks(filePath: string, courseNameOverride?: string, dayNameOverride?: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const raw = fs.readFileSync(path.resolve(filePath), "utf-8");
  const parsed = JSON.parse(raw);

  const links: LinkJSON[] = parsed.links;
  const courseName: string = courseNameOverride ?? parsed.course?.title;

  if (!links?.length) {
    console.log("No links found in file.");
    return;
  }

  if (!courseName) {
    console.error("No course title found in file.");
    return;
  }

  console.log(`\nImporting links for: ${courseName}`);

  // 1. Find the course (try exact match first, then case-insensitive contains)
  let { data: course } = await supabase
    .from("courses")
    .select("id, name")
    .eq("name", courseName)
    .maybeSingle();

  if (!course) {
    // Try a loose match on the first word(s)
    const keyword = courseName.split(" ").slice(0, 2).join(" ");
    const { data: fuzzy } = await supabase
      .from("courses")
      .select("id, name")
      .ilike("name", `%${keyword}%`);

    if (fuzzy && fuzzy.length === 1) {
      course = fuzzy[0];
      console.log(`  (matched "${courseName}" → "${course.name}")`);
    } else {
      // Show available courses to help the user
      const { data: all } = await supabase.from("courses").select("name").order("name");
      console.error(`\nCourse not found: "${courseName}"`);
      console.error("Courses in the database:");
      (all ?? []).forEach(c => console.error(`  - ${c.name}`));
      return;
    }
  }

  console.log(`✓ Found course: ${course.id}`);

  // 2. Group links by module_title
  const linksByModule = new Map<string, LinkJSON[]>();
  for (const link of links) {
    const key = link.module_title || "";
    if (!linksByModule.has(key)) linksByModule.set(key, []);
    linksByModule.get(key)!.push(link);
  }

  // 3. Load all modules for this course
  const { data: modules } = await supabase
    .from("modules")
    .select("id, title")
    .eq("course_id", course.id);

  const moduleByTitle = new Map((modules ?? []).map(m => [m.title, m]));

  // Load current max module order
  const { data: allModules } = await supabase
    .from("modules")
    .select("order")
    .eq("course_id", course.id)
    .order("order", { ascending: false })
    .limit(1);

  let nextModuleOrder = (allModules?.[0]?.order ?? -1) + 1;

  let totalImported = 0;
  let totalSkipped = 0;

  for (const [moduleTitle, moduleLinks] of linksByModule) {
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
        totalSkipped += moduleLinks.length;
        continue;
      }

      moduleByTitle.set(moduleTitle, newModule);
      module = newModule;
    }

    console.log(`  Module: ${moduleTitle} (${moduleLinks.length} links)`);

    // 4. Find or create day for this module
    const targetDayName = dayNameOverride ?? "Resources";
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
        continue;
      }

      dayId = newDay.id;
      console.log(`    ↳ Created "${targetDayName}" day`);
    }

    // 5. Check existing resources in this day to avoid duplicates
    const { data: existing } = await supabase
      .from("resources")
      .select("content")
      .eq("module_day_id", dayId);

    const existingUrls = new Set((existing ?? []).map(r => r.content));

    // 6. Insert links as resources
    const toInsert = moduleLinks.filter(l => !existingUrls.has(l.url));
    const skipped = moduleLinks.length - toInsert.length;
    if (skipped > 0) console.log(`    ↳ Skipping ${skipped} already-imported link(s)`);

    if (toInsert.length > 0) {
      // Get starting order
      const { data: lastResource } = await supabase
        .from("resources")
        .select("order")
        .eq("module_day_id", dayId)
        .order("order", { ascending: false })
        .limit(1);

      const startOrder = (lastResource?.[0]?.order ?? -1) + 1;

      const rows = toInsert.map((link, i) => ({
        module_day_id: dayId,
        type: "link" as const,
        title: link.title,
        content: link.url,
        order: startOrder + i,
      }));

      const { error: insertError } = await supabase.from("resources").insert(rows);

      if (insertError) {
        console.error(`    ✗ Insert failed:`, insertError.message);
      } else {
        console.log(`    ✓ Inserted ${rows.length} link(s)`);
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
  console.error('Usage: npx ts-node --esm scripts/import-links.ts <path-to-links-json> ["Course Name Override"] ["Day Name Override"]');
  process.exit(1);
}

importLinks(filePath, courseNameOverride, dayNameOverride);
