import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InstructorTopNav from "@/components/ui/InstructorTopNav";
import InstructorSidebar from "@/components/ui/InstructorSidebar";
import QuizzesSection from "@/components/instructor/QuizzesSection";
import { getQuizzesForCourse, type QuizRow } from "@/data/quizzes";
import { getInstructorOrTaAccess } from "@/lib/instructor-access";

export default async function InstructorQuizzesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ open?: string }>;
}) {
  const { id } = await params;
  const { open: initialOpenQuizId } = await searchParams;
  const { user, profile, isTa } = await getInstructorOrTaAccess(id);
  const supabase = await createServerSupabaseClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, code")
    .eq("id", id)
    .single();

  if (!course) redirect("/instructor/courses");

  const jsonQuizzes = getQuizzesForCourse(course);

  let adminClient: ReturnType<typeof createServiceSupabaseClient> | null = null;
  try { adminClient = createServiceSupabaseClient(); } catch { /* no service key */ }
  const readClient = adminClient ?? supabase;

  const [{ data: dbQuizzesRaw }, { data: modulesRaw }] = await Promise.all([
    readClient
      .from("quizzes")
      .select("*")
      .eq("course_id", id)
      .order("module_title", { ascending: true })
      .order("title", { ascending: true }),
    supabase
      .from("modules")
      .select("title, order")
      .eq("course_id", id)
      .order("order", { ascending: true }),
  ]);
  let dbQuizzes = dbQuizzesRaw as QuizRow[] | null;
  const moduleTitles = (modulesRaw ?? [])
    .map((m) => m.title as string)
    .filter((t) => t && t.trim() !== '');

  // Auto-sync from JSON if DB is empty
  if ((!dbQuizzes || dbQuizzes.length === 0) && jsonQuizzes.length > 0) {
    const insertClient = readClient;
    const { error } = await insertClient.from("quizzes").insert(
      jsonQuizzes.map((q) => ({
        course_id: id,
        identifier: q.identifier,
        title: q.title,
        due_at: q.due_at?.trim() || null,
        module_title: q.module_title || "",
        published: false,
        questions: q.questions ?? [],
        max_attempts: null,
      }))
    );
    if (!error) {
      const res = await insertClient
        .from("quizzes")
        .select("*")
        .eq("course_id", id)
        .order("module_title", { ascending: true })
        .order("title", { ascending: true });
      dbQuizzes = (res.data ?? []) as QuizRow[];
    }
  }

  const quizzes: QuizRow[] =
    dbQuizzes && dbQuizzes.length > 0
      ? dbQuizzes
      : jsonQuizzes.map((q) => ({
          id: `json-${q.identifier}`,
          course_id: id,
          identifier: q.identifier,
          title: q.title,
          due_at: q.due_at?.trim() || null,
          module_title: q.module_title || "",
          published: false,
          questions: q.questions ?? [],
          max_attempts: null,
        })) as QuizRow[];

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-6 sm:px-8 sm:py-10 focus:outline-none">
            <div className="flex items-center justify-between mb-6">
              <Link
                href={`/instructor/courses/${id}`}
                className="text-muted-text hover:text-teal-primary text-sm"
              >
                ← Course
              </Link>
              <Link
                href={`/instructor/courses/${id}/quiz-submissions`}
                className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:border-teal-primary hover:text-teal-primary transition-colors"
              >
                View Submissions →
              </Link>
            </div>

            <QuizzesSection courseId={id} quizzes={quizzes} initialOpenQuizId={initialOpenQuizId} moduleTitles={moduleTitles} />
          </main>
        </div>
      </div>
    </div>
  );
}
