import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import StudentTopNav from "@/components/ui/StudentTopNav";
import NavDrawer from "@/components/ui/NavDrawer";
import { isStudentPreview } from "@/lib/student-preview";
import StudentViewBanner from "@/components/ui/StudentViewBanner";

function formatDueDate(dueAt: string | null): string {
  if (!dueAt || !dueAt.trim()) return "No due date";
  try {
    return new Date(dueAt).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dueAt;
  }
}

export default async function StudentQuizzesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, role")
    .eq("id", user.id)
    .single();

  const preview = await isStudentPreview(id);

  if (!preview && (profile?.role === "instructor" || profile?.role === "admin")) {
    redirect(`/instructor/courses/${id}`);
  }

  if (!preview) {
    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", id)
      .eq("role", "student")
      .maybeSingle();

    if (!enrollment) redirect("/student/courses");
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, code, paid_learners")
    .eq("id", id)
    .single();

  if (!course) redirect("/student/courses");

  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, title, due_at, module_title, questions, max_attempts")
    .eq("course_id", id)
    .eq("published", true)
    .order("module_title", { ascending: true })
    .order("title", { ascending: true });

  const quizList = quizzes ?? [];
  const quizIds = quizList.map((q) => q.id);

  const { data: submissions } =
    quizIds.length > 0
      ? await supabase
          .from("quiz_submissions")
          .select("quiz_id, score_percent, attempt_count")
          .eq("student_id", user.id)
          .in("quiz_id", quizIds)
      : { data: [] };

  const subMap = new Map(
    (submissions ?? []).map((s) => [s.quiz_id, s])
  );

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />
      {preview && <StudentViewBanner courseId={id} />}
      <NavDrawer courseId={id} courseName={course.name} paidLearners={course.paid_learners ?? false}>
        <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-10 focus:outline-none">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-dark-text">Quizzes</h1>
            <p className="text-sm text-muted-text mt-1">{course.name}</p>
          </div>

          {quizList.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-border p-12 text-center">
              <p className="text-muted-text">No published quizzes for this course yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {quizList.map((quiz) => {
                const displayTitle = quiz.title?.startsWith("Quiz: ") ? quiz.title.slice(6) : quiz.title;
                const questionCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
                const sub = subMap.get(quiz.id);
                const attemptsUsed = sub?.attempt_count ?? 0;
                const maxAttempts: number | null = quiz.max_attempts ?? null;
                const outOfAttempts = maxAttempts !== null && attemptsUsed >= maxAttempts;

                return (
                  <Link
                    key={quiz.id}
                    href={`/student/courses/${id}/quizzes/${quiz.id}`}
                    className="block bg-surface rounded-2xl border border-border p-6 hover:border-teal-primary transition-colors"
                  >
                    <h3 className="font-semibold text-dark-text">{displayTitle}</h3>
                    {quiz.module_title && (
                      <p className="text-xs text-muted-text mt-1">{quiz.module_title}</p>
                    )}
                    <p className="text-sm text-muted-text mt-2">
                      Due: {formatDueDate(quiz.due_at)} · {questionCount} question{questionCount !== 1 ? "s" : ""}
                      {maxAttempts !== null && ` · up to ${maxAttempts} attempts`}
                    </p>
                    {sub && (
                      <p className="text-sm text-muted-text mt-1">
                        Score: {sub.score_percent != null ? `${Math.round(sub.score_percent)}%` : "—"}
                        {" · "}{attemptsUsed} attempt{attemptsUsed !== 1 ? "s" : ""} used
                      </p>
                    )}
                    <p className={`text-sm font-medium mt-3 ${outOfAttempts ? "text-muted-text" : "text-teal-primary"}`}>
                      {outOfAttempts ? "View results →" : sub ? "Retake quiz →" : "Take quiz →"}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </main>
      </NavDrawer>
    </div>
  );
}
