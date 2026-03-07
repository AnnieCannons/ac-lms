import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import StudentTopNav from "@/components/ui/StudentTopNav";
import NavDrawer from "@/components/ui/NavDrawer";
import { isStudentPreview } from "@/lib/student-preview";
import StudentViewBanner from "@/components/ui/StudentViewBanner";
import QuizForm from "./QuizForm";
import HtmlContent from "@/components/ui/HtmlContent";

type Question = {
  ident: string;
  question_text: string;
  choices: Array<{ ident: string; text: string }>;
  correct_response_ident: string;
  question_type?: "multiple_choice" | "true_false";
  code_snippet?: string;
  code_language?: string;
};

type AnswerInput = { question_ident: string; choice_ident: string };

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
    .select("id, name, paid_learners")
    .eq("id", id)
    .single();

  if (!course) redirect("/student/courses");

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, title, module_title, questions, max_attempts")
    .eq("id", quizId)
    .eq("course_id", id)
    .eq("published", true)
    .single();

  if (!quiz) redirect(`/student/courses/${id}/quizzes`);

  const { data: submission } = await supabase
    .from("quiz_submissions")
    .select("id, submitted_at, score_percent, answers, attempt_count")
    .eq("quiz_id", quizId)
    .eq("student_id", user.id)
    .maybeSingle();

  const questions = (quiz.questions ?? []) as Question[];
  const maxAttempts: number | null = quiz.max_attempts ?? null;
  const attemptCount = submission?.attempt_count ?? 0;
  const outOfAttempts = maxAttempts !== null && attemptCount >= maxAttempts;
  const attemptsLeft = maxAttempts !== null ? maxAttempts - attemptCount : null;

  const displayTitle = quiz.title?.startsWith("Quiz: ") ? quiz.title.slice(6) : quiz.title;

  // Previous answers (for retake merge)
  const previousAnswers: AnswerInput[] = Array.isArray(submission?.answers)
    ? (submission.answers as AnswerInput[])
    : [];

  // For retake: show only wrong questions
  const wrongQuestions = submission
    ? questions.filter((q) => {
        const prev = previousAnswers.find((a) => a.question_ident === q.ident);
        return !prev || prev.choice_ident !== q.correct_response_ident;
      })
    : questions;

  // Score breakdown for results display
  const totalQ = questions.length;
  const correctCount = submission
    ? questions.filter((q) => {
        const prev = previousAnswers.find((a) => a.question_ident === q.ident);
        return prev?.choice_ident === q.correct_response_ident;
      }).length
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />
      {preview && <StudentViewBanner courseId={id} />}
      <NavDrawer courseId={id} courseName={course.name} paidLearners={course.paid_learners ?? false}>
        <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-10 focus:outline-none">
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
            <p className="text-sm text-muted-text mb-2">{quiz.module_title}</p>
          )}
          {maxAttempts !== null && (
            <p className="text-xs text-muted-text mb-6">
              {outOfAttempts
                ? `All ${maxAttempts} attempt${maxAttempts !== 1 ? "s" : ""} used`
                : `${attemptCount} of ${maxAttempts} attempt${maxAttempts !== 1 ? "s" : ""} used`}
            </p>
          )}

          {/* STATE: No submission — show full quiz */}
          {!submission && questions.length === 0 && (
            <p className="text-muted-text">This quiz has no questions yet.</p>
          )}
          {!submission && questions.length > 0 && (
            <QuizForm
              courseId={id}
              quizId={quizId}
              questions={questions}
              previousAnswers={[]}
            />
          )}

          {/* STATE: Has submission */}
          {submission && (
            <div className="flex flex-col gap-6">
              {/* Score card */}
              <div className="bg-teal-light border border-teal-primary/30 rounded-xl px-5 py-4">
                <p className="text-base font-semibold text-dark-text">
                  {correctCount} / {totalQ} correct
                  {submission.score_percent != null && (
                    <span className="ml-2 text-teal-primary">
                      · {Math.round(submission.score_percent)}%
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-text mt-1">
                  Submitted{" "}
                  {new Date(submission.submitted_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {attemptCount > 1 && ` · Attempt ${attemptCount}`}
                </p>
              </div>

              {/* Per-question breakdown */}
              <div className="flex flex-col gap-4">
                {questions.map((q, i) => {
                  const studentAnswer = previousAnswers.find((a) => a.question_ident === q.ident);
                  const isCorrect = studentAnswer?.choice_ident === q.correct_response_ident;
                  const studentChoice = q.choices?.find((c) => c.ident === studentAnswer?.choice_ident);
                  const correctChoice = q.choices?.find((c) => c.ident === q.correct_response_ident);

                  return (
                    <div
                      key={q.ident}
                      className={`bg-surface rounded-xl border px-5 py-4 ${
                        isCorrect ? "border-green-500/40" : "border-red-500/40"
                      }`}
                    >
                      <div className="flex items-start gap-2 mb-3">
                        <span className={`shrink-0 font-bold text-base mt-0.5 ${isCorrect ? "text-green-500" : "text-red-500"}`}>
                          {isCorrect ? "✓" : "✗"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">
                            Question {i + 1}
                          </p>
                          <div className="text-sm text-dark-text [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_li_p]:inline [&_strong]:font-bold [&_em]:italic [&_code]:font-mono [&_code]:bg-border/30 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-border/20 [&_pre]:rounded-lg [&_pre]:px-4 [&_pre]:py-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:text-xs [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded">
                            <HtmlContent html={q.question_text || ""} />
                          </div>
                        </div>
                      </div>

                      <div className="text-sm pl-6">
                        {!isCorrect && (
                          <p className="text-red-500">
                            Your answer:{" "}
                            <span className="[&_img]:inline [&_img]:max-h-6">
                              <HtmlContent html={studentChoice?.text ?? "(no answer)"} />
                            </span>
                          </p>
                        )}
                        {outOfAttempts && !isCorrect && correctChoice && (
                          <p className="text-green-600 dark:text-green-400 mt-1">
                            Correct answer:{" "}
                            <span className="[&_img]:inline [&_img]:max-h-6">
                              <HtmlContent html={correctChoice.text} />
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Retake or locked */}
              {!outOfAttempts && wrongQuestions.length > 0 && (
                <div className="bg-surface rounded-2xl border border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-semibold text-dark-text">
                        Retake — wrong questions only
                      </h2>
                      <p className="text-xs text-muted-text mt-0.5">
                        {wrongQuestions.length} question{wrongQuestions.length !== 1 ? "s" : ""} to redo
                        {attemptsLeft !== null && ` · ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} left`}
                      </p>
                    </div>
                  </div>
                  <QuizForm
                    courseId={id}
                    quizId={quizId}
                    questions={wrongQuestions}
                    previousAnswers={previousAnswers}
                  />
                </div>
              )}

              {!outOfAttempts && wrongQuestions.length === 0 && (
                <p className="text-sm text-teal-primary font-medium">
                  You got everything right! 🎉
                </p>
              )}

              {outOfAttempts && (
                <div className="text-sm text-muted-text bg-surface border border-border rounded-xl px-5 py-4">
                  You&apos;ve used all {maxAttempts} attempt{maxAttempts !== 1 ? "s" : ""}. Correct answers are shown above.
                </div>
              )}
            </div>
          )}
        </main>
      </NavDrawer>
    </div>
  );
}
