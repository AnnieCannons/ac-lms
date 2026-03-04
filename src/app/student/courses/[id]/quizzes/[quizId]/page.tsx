import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/ui/LogoutButton";
import StudentCourseNav from "@/components/ui/StudentCourseNav";
import QuizForm from "./QuizForm";

export default async function TakeQuizPage({
  params,
}: {
  params: Promise<{ id: string; quizId: string }>;
}) {
  const { id, quizId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "instructor" || profile?.role === "admin") {
    redirect(`/instructor/courses/${id}`);
  }

  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", id)
    .eq("role", "student")
    .maybeSingle();

  if (!enrollment) redirect("/student/courses");

  const { data: course } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!course) redirect("/student/courses");

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, title, module_title, questions")
    .eq("id", quizId)
    .eq("course_id", id)
    .eq("published", true)
    .single();

  if (!quiz) redirect(`/student/courses/${id}/quizzes`);

  const { data: existing } = await supabase
    .from("quiz_submissions")
    .select("id, submitted_at, score_percent")
    .eq("quiz_id", quizId)
    .eq("student_id", user.id)
    .maybeSingle();

  const questions = (quiz.questions ?? []) as Array<{
    ident: string;
    question_text: string;
    choices: Array<{ ident: string; text: string }>;
  }>;
  const displayTitle = quiz.title?.startsWith("Quiz: ") ? quiz.title.slice(6) : quiz.title;

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <Link href="/student/courses" className="text-xl font-extrabold text-dark-text">
          AC<span className="text-teal-primary">*</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {profile?.name} ·{" "}
            <span className="text-teal-primary font-medium capitalize">{profile?.role}</span>
          </span>
          <LogoutButton />
        </div>
      </nav>

      <div className="flex">
        <aside className="w-56 shrink-0 border-r border-border min-h-[calc(100vh-65px)] py-8 px-3">
          <StudentCourseNav courseId={id} courseName={course.name} />
        </aside>

        <div className="flex-1 min-w-0">
          <main className="max-w-3xl mx-auto px-8 py-10">
            <div className="mb-6">
              <Link
                href={`/student/courses/${id}/quizzes`}
                className="text-muted-text hover:text-teal-primary text-sm"
              >
                ← Quizzes
              </Link>
            </div>

            <h1 className="text-2xl font-bold text-dark-text mb-1">{displayTitle}</h1>
            {quiz.module_title && (
              <p className="text-sm text-muted-text mb-6">{quiz.module_title}</p>
            )}

            {existing && (
              <div className="bg-teal-light border border-teal-primary/30 rounded-xl px-4 py-3 mb-6 text-sm text-dark-text">
                You submitted this quiz on{" "}
                {new Date(existing.submitted_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {existing.score_percent != null && (
                  <> · Score: {existing.score_percent}%</>
                )}
                . You can retake it below; your latest submission will be saved.
              </div>
            )}

            {questions.length === 0 ? (
              <p className="text-muted-text">This quiz has no questions yet.</p>
            ) : (
              <QuizForm courseId={id} quizId={quizId} questions={questions} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
