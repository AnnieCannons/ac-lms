import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InstructorTopNav from "@/components/ui/InstructorTopNav";
import CourseEditor from "@/components/layout/CourseEditor";
import CourseNameEditor from "@/components/ui/CourseNameEditor";
import QuizzesSection from "@/components/instructor/QuizzesSection";
import { getQuizzesForCourse, type QuizRow } from "@/data/quizzes";
import InstructorSidebar from "@/components/ui/InstructorSidebar";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "instructor" && profile?.role !== "admin") {
    redirect("/unauthorized");
  }

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();

  if (!course) redirect("/instructor/courses");

  const { data: modules } = await supabase
    .from("modules")
    .select("*, module_days(*, assignments(*))")
    .eq("course_id", id)
    .order("order", { ascending: true });

  // Quizzes: fetch from DB; if empty, try to sync from JSON (published: false) then re-fetch
  const jsonQuizzes = getQuizzesForCourse(course);
  const { data: dbQuizzesRaw } = await supabase
    .from("quizzes")
    .select("*")
    .eq("course_id", id)
    .order("module_title", { ascending: true })
    .order("title", { ascending: true });
  let dbQuizzes = dbQuizzesRaw as QuizRow[] | null;

  if ((!dbQuizzes || dbQuizzes.length === 0) && jsonQuizzes.length > 0) {
    const { error } = await supabase.from("quizzes").insert(
      jsonQuizzes.map((q) => ({
        course_id: id,
        identifier: q.identifier,
        title: q.title,
        due_at: q.due_at?.trim() || null,
        module_title: q.module_title || "",
        published: false,
        questions: q.questions ?? [],
      }))
    );
    if (!error) {
      const res = await supabase
        .from("quizzes")
        .select("*")
        .eq("course_id", id)
        .order("module_title", { ascending: true })
        .order("title", { ascending: true });
      dbQuizzes = (res.data ?? []) as QuizRow[];
    }
  }

  // Use DB quizzes if we have any; otherwise show quizzes from JSON (e.g. before migration or if sync failed)
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
        })) as QuizRow[];

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-8 py-10 focus:outline-none">
            <div className="mb-6">
              <Link
                href="/instructor/courses"
                className="text-muted-text hover:text-teal-primary text-sm"
              >
                ← Courses
              </Link>
            </div>
            <CourseNameEditor
              courseId={course.id}
              initialName={course.name}
              initialCode={course.code}
            />

            <CourseEditor course={course} initialModules={modules || []} />

            <QuizzesSection courseId={id} quizzes={quizzes} />
          </main>
        </div>
      </div>
    </div>
  );
}
