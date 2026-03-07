/**
 * Backfill quizzes from JSON data files into the `quizzes` table.
 * Matches courses by name/code (TCF, Frontend, Backend) and upserts quizzes with published: false.
 *
 * Prerequisites:
 *   - Run the quizzes migration: supabase/migrations/20250304000000_create_quizzes.sql
 *   - Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (e.g. from .env.local)
 *
 * Usage: npm run backfill-quizzes
 *   (or: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/backfill-quizzes.ts)
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });
import * as fs from "fs";
import * as path from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const QUIZ_JSON_FILES = [
  { path: "src/data/tcf/tcf-quizzes.json", match: "tcf" },
  { path: "src/data/frontend/advanced-frontend-quizzes.json", match: "frontend" },
  { path: "src/data/backend/advanced-backend-quizzes.json", match: "backend" },
];

type QuizAssessment = {
  identifier: string;
  type: string;
  title: string;
  due_at: string;
  quiz_type: string;
  module_title: string;
  manifest_title: string;
  questions: unknown[];
};

type QuizCourseData = {
  course: { title: string; source?: string };
  assessments: QuizAssessment[];
};

async function backfillQuizzes() {
  let totalUpserted = 0;

  for (const { path: filePath, match } of QUIZ_JSON_FILES) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      console.log(`Skipping missing file: ${filePath}`);
      continue;
    }

    const parsed = JSON.parse(fs.readFileSync(resolved, "utf-8")) as QuizCourseData;
    const quizzes = (parsed.assessments ?? []).filter((a) => a.type === "quiz");
    const courseTitle = parsed.course?.title ?? path.basename(filePath, ".json");

    if (quizzes.length === 0) {
      console.log(`\n${filePath}: no quizzes in file`);
      continue;
    }

    // Find courses that match this quiz set (e.g. name or code contains "tcf", "frontend", "backend")
    const { data: courses, error: coursesError } = await supabase
      .from("courses")
      .select("id, name, code");

    if (coursesError) {
      console.error(`${filePath}: failed to fetch courses: ${coursesError.message}`);
      continue;
    }

    const matchingCourses = (courses ?? []).filter((c) => {
      const combined = ` ${(c.name ?? "").toLowerCase()} ${(c.code ?? "").toLowerCase()} `;
      if (match === "tcf") return combined.includes("tcf");
      if (match === "frontend")
        return (
          combined.includes("frontend") ||
          combined.includes("front end") ||
          combined.includes("front-end")
        );
      if (match === "backend")
        return (
          combined.includes("backend") ||
          combined.includes("back end") ||
          combined.includes("back-end")
        );
      return false;
    });

    if (matchingCourses.length === 0) {
      console.log(`\n${filePath}: no matching course in DB for "${courseTitle}" (match: ${match})`);
      continue;
    }

    console.log(`\n${filePath}: ${quizzes.length} quizzes → ${matchingCourses.length} course(s)`);

    for (const course of matchingCourses) {
      const rows = quizzes.map((q) => ({
        course_id: course.id,
        identifier: q.identifier,
        title: q.title,
        due_at: q.due_at?.trim() || null,
        module_title: q.module_title || "",
        published: false,
        questions: q.questions ?? [],
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from("quizzes")
        .upsert(rows, { onConflict: "course_id,identifier", ignoreDuplicates: false })
        .select("id");

      if (error) {
        console.error(`  ✗ ${course.name}: ${error.message}`);
      } else {
        const count = data?.length ?? 0;
        console.log(`  ✓ ${course.name}: ${count} quiz(zes) upserted`);
        totalUpserted += count;
      }
    }
  }

  console.log(`\n✅ Done. ${totalUpserted} quiz(zes) upserted.`);
}

backfillQuizzes();
