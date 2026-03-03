import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Initialize Supabase with service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type AssignmentJSON = {
  identifier: string
  title: string
  due_at: string | null
  grading_type: string
  submission_types: string
  workflow_state: string
  description_html: string
  module_title: string
  manifest_title: string
};

async function importCourse(filePath: string) {
  const raw = fs.readFileSync(path.resolve(filePath), "utf-8");
  const parsed = JSON.parse(raw);

  const assignments: AssignmentJSON[] = parsed.assignments;
  const courseName = parsed.course?.title || path.basename(filePath, ".json");
  const courseCode = courseName.toUpperCase().replace(/\s+/g, "-").slice(0, 20);

  if (!assignments?.length) {
    console.log("No assignments found in file.");
    return;
  }

  console.log(`\nImporting course: ${courseName}`);

  // 1. Create the course
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .insert({ name: courseName, code: courseCode })
    .select()
    .single();

  if (courseError) {
    console.error("Failed to create course:", courseError.message);
    return;
  }

  console.log(`✓ Course created: ${course.id}`);

  // 2. Group assignments by module_title
  const moduleMap = new Map<string, AssignmentJSON[]>();
  for (const assignment of assignments) {
    const key = assignment.module_title || "";
    if (!moduleMap.has(key)) moduleMap.set(key, []);
    moduleMap.get(key)!.push(assignment);
  }

  let moduleOrder = 0;
  for (const [moduleTitle, moduleAssignments] of moduleMap) {
    // 3. Create the module
    const weekMatch = moduleTitle?.match(/week\s*(\d+)/i);
    const weekNumber = weekMatch ? parseInt(weekMatch[1]) : moduleOrder + 1;

    const { data: module, error: moduleError } = await supabase
      .from("modules")
      .insert({
        course_id: course.id,
        title: moduleTitle,
        week_number: weekNumber,
        order: moduleOrder,
      })
      .select()
      .single();

    if (moduleError) {
      console.error(
        `Failed to create module "${moduleTitle}":`,
        moduleError.message,
      );
      continue;
    }

    console.log(`  ✓ Module: ${moduleTitle}`);

    // 4. Create a single module day to hold the assignments
    const { data: day, error: dayError } = await supabase
      .from("module_days")
      .insert({
        module_id: module.id,
        day_name: "Assignments",
        order: 0,
      })
      .select()
      .single();

    if (dayError) {
      console.error(
        `Failed to create day for module "${moduleTitle}":`,
        dayError.message,
      );
      continue;
    }

    // 5. Insert each assignment
    for (let i = 0; i < moduleAssignments.length; i++) {
      const a = moduleAssignments[i];
      const { error: assignmentError } = await supabase
        .from("assignments")
        .insert({
          module_day_id: day.id,
          title: a.title,
          description: a.description_html,
          due_date: a.due_at || null,
        });

      if (assignmentError) {
        console.error(
          `    Failed to insert assignment "${a.title}":`,
          assignmentError.message,
        );
      } else {
        console.log(`    ✓ Assignment: ${a.title}`);
      }
    }

    moduleOrder++;
  }

  console.log(`\n✅ Import complete for: ${courseName}`);
}

// Get file path from CLI arg
const filePath = process.argv[2];
if (!filePath) {
  console.error(
    "Usage: npx ts-node scripts/import-course.ts <path-to-json-file>",
  );
  process.exit(1);
}

importCourse(filePath);
