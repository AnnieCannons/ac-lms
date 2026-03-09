import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import StudentTopNav from "@/components/ui/StudentTopNav";
import ResizableSidebar from "@/components/ui/ResizableSidebar";
import StudentCourseNav from "@/components/ui/StudentCourseNav";
import { isStudentPreview } from "@/lib/student-preview";
import StudentViewBanner from "@/components/ui/StudentViewBanner";
import QuizForm from "./QuizForm";
import { type AnswerEntry } from "./actions";
import HtmlContent from "@/components/ui/HtmlContent";
import HighlightedContent from "@/components/ui/HighlightedContent";

type Question = {
  ident: string;
  question_text: string;
  choices: Array<{ ident: string; text: string }>;
  correct_response_ident: string;
  question_type?: "multiple_choice" | "true_false";
  code_snippet?: string;
  code_language?: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function codeSnippetHtml(snippet: string, language?: string): string {
  return `<pre><code class="language-${language || "javascript"}">${escapeHtml(snippet)}</code></pre>`;
}

export default async function TakeQuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; quizId: string }>;
  searchParams: Promise<{ retake?: string }>;
}) {
  const { id, quizId } = await params;
  const { retake } = await searchParams;
  const isRetakeMode = retake === "1";

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

  let isObserver = false;
  if (!preview) {
    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id, role")
      .eq("user_id", user.id)
      .eq("course_id", id)
      .in("role", ["student", "observer"])
      .maybeSingle();

    if (!enrollment) redirect("/student/courses");
    isObserver = enrollment.role === "observer";
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, paid_learners")
    .eq("id", id)
    .single();

  if (!course) redirect("/student/courses");

  const admin = createServiceSupabaseClient();

  const { data: quiz } = await admin
    .from("quizzes")
    .select("id, title, module_title, questions, max_attempts")
    .eq("id", quizId)
    .eq("course_id", id)
    .eq("published", true)
    .single();

  if (!quiz) redirect(`/student/courses/${id}/quizzes`);

  const { data: submission } = await admin
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

  // Build index-based answer map from stored submission
  const previousAnswersMap = new Map<number, string>();
  if (submission?.answers && Array.isArray(submission.answers)) {
    for (const a of (submission.answers as Array<{ question_index?: number; question_ident?: string; choice_ident: string }>)) {
      // Support both new index-based and old ident-based format (backward compat)
      if (typeof a.question_index === "number") {
        previousAnswersMap.set(a.question_index, a.choice_ident);
      }
    }
  }

  // Previous answers as array for QuizForm hidden input
  const previousAnswers: AnswerEntry[] = Array.from(previousAnswersMap.entries()).map(
    ([question_index, choice_ident]) => ({ question_index, choice_ident })
  );

  // Correct vs wrong
  const correctCount = questions.filter((q, i) =>
    previousAnswersMap.get(i) === q.correct_response_ident
  ).length;
  const wrongCount = questions.length - correctCount;

  // Locked answers (correctly answered questions) — for retake display
  const lockedAnswers: Record<string, string> = {};
  for (let i = 0; i < questions.length; i++) {
    const choice = previousAnswersMap.get(i);
    if (choice && choice === questions[i].correct_response_ident) {
      lockedAnswers[String(i)] = choice;
    }
  }

  // Observers can never retake — they only see results
  const effectiveCanRetake = !isObserver && !outOfAttempts;

  // Guard retake mode: must have a submission, attempts remaining, and wrong questions
  if (isRetakeMode && (!submission || !effectiveCanRetake || wrongCount === 0)) {
    redirect(`/student/courses/${id}/quizzes/${quizId}`);
  }

  // Restore in-progress answers (initial take only, not retake)
  let savedProgress: Record<string, string> | undefined;
  if (!submission && !isRetakeMode) {
    const { data: progressRow } = await admin
      .from("quiz_progress")
      .select("answers_json")
      .eq("quiz_id", quizId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (progressRow?.answers_json) {
      const progressAnswers = progressRow.answers_json as Array<{ question_index?: number; choice_ident?: string }>;
      const progress: Record<string, string> = {};
      for (const a of progressAnswers) {
        if (typeof a.question_index === "number" && typeof a.choice_ident === "string") {
          progress[String(a.question_index)] = a.choice_ident;
        }
      }
      if (Object.keys(progress).length > 0) savedProgress = progress;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <StudentTopNav name={profile?.name} role={profile?.role} />
      {preview && <StudentViewBanner courseId={id} />}
      <div className="flex">
        <ResizableSidebar>
          <StudentCourseNav courseId={id} courseName={course.name} paidLearners={course.paid_learners ?? false} />
        </ResizableSidebar>
        <div className="flex-1 min-w-0">
        <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-4 py-8 sm:px-8 sm:py-10 focus:outline-none">

          {/* RETAKE MODE */}
          {isRetakeMode && submission && (
            <>
              <div className="mb-6 flex items-center gap-4">
                <Link
                  href={`/student/courses/${id}/quizzes/${quizId}`}
                  className="text-muted-text hover:text-teal-primary text-sm"
                >
                  ← Back to results
                </Link>
              </div>
              <h1 className="text-2xl font-bold text-dark-text mb-1">{displayTitle}</h1>
              {quiz.module_title && (
                <p className="text-sm text-muted-text mb-2">{quiz.module_title}</p>
              )}
              {maxAttempts !== null && (
                <p className="text-xs text-muted-text mb-6">
                  {attemptCount} of {maxAttempts} attempt{maxAttempts !== 1 ? "s" : ""} used
                </p>
              )}
              <p className="text-sm text-muted-text mb-6">
                Correct answers are locked.{" "}
                <span className="text-orange-400">{wrongCount} question{wrongCount !== 1 ? "s" : ""} to redo.</span>
              </p>
              <QuizForm
                courseId={id}
                quizId={quizId}
                questions={questions}
                previousAnswers={previousAnswers}
                lockedAnswers={lockedAnswers}
              />
            </>
          )}

          {/* NORMAL MODE */}
          {!isRetakeMode && (
            <>
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

              {/* No submission yet */}
              {!submission && questions.length === 0 && (
                <p className="text-muted-text">This quiz has no questions yet.</p>
              )}
              {!submission && questions.length > 0 && (
                <QuizForm
                  courseId={id}
                  quizId={quizId}
                  questions={questions}
                  previousAnswers={[]}
                  savedProgress={savedProgress}
                  isObserver={isObserver}
                />
              )}

              {/* Has submission — show results */}
              {submission && (
                <div className="flex flex-col gap-4">
                  {/* Score card */}
                  <div className="bg-teal-light border border-teal-primary/30 rounded-xl px-5 py-4">
                    <p className="text-base font-semibold text-dark-text">
                      {correctCount} / {questions.length} correct
                      {submission.score_percent != null && (
                        <span className="ml-2 text-teal-primary">
                          · {Math.round(submission.score_percent as number)}%
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-text mt-1">
                      Submitted{" "}
                      {new Date(submission.submitted_at as string).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {attemptCount > 1 && ` · Attempt ${attemptCount}`}
                    </p>
                  </div>

                  {/* Retake button */}
                  {effectiveCanRetake && wrongCount > 0 && (
                    <div className="flex items-center justify-between bg-surface border border-border rounded-xl px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-dark-text">
                          {wrongCount} question{wrongCount !== 1 ? "s" : ""} to retake
                        </p>
                        {attemptsLeft !== null && (
                          <p className="text-xs text-muted-text mt-0.5">
                            {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/student/courses/${id}/quizzes/${quizId}?retake=1`}
                        className="px-5 py-2.5 rounded-full bg-teal-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                      >
                        Retake Quiz →
                      </Link>
                    </div>
                  )}

                  {/* All correct */}
                  {wrongCount === 0 && (
                    <p className="text-sm text-teal-primary font-medium">
                      You got everything right! 🎉
                    </p>
                  )}

                  {/* Per-question breakdown */}
                  <div className="flex flex-col gap-3">
                    {questions.map((q, i) => {
                      const studentChoiceIdent = previousAnswersMap.get(i);
                      const isCorrect = studentChoiceIdent === q.correct_response_ident;
                      const studentChoice = q.choices?.find((c) => c.ident === studentChoiceIdent);
                      const correctChoice = q.choices?.find((c) => c.ident === q.correct_response_ident);

                      return (
                        <div
                          key={i}
                          className={`bg-surface rounded-xl border px-5 py-4 ${
                            isCorrect
                              ? "border-green-500/30 opacity-70"
                              : "border-orange-500/40"
                          }`}
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <span className={`shrink-0 font-bold text-base mt-0.5 ${
                              isCorrect ? "text-green-700 dark:text-green-500" : "text-orange-600 dark:text-orange-400"
                            }`}>
                              {isCorrect ? "✓" : "✗"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-muted-text uppercase tracking-wide mb-1">
                                Question {i + 1}
                              </p>
                              <HighlightedContent
                                html={q.question_text || ""}
                                className="quiz-html text-sm text-dark-text [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_li_p]:inline [&_strong]:font-bold [&_em]:italic [&_pre]:my-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:bg-[#1e1e2e] [&_pre]:border [&_pre]:border-[#313244] [&_pre]:p-4 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded"
                              />
                              {q.code_snippet && (
                                <HighlightedContent
                                  html={codeSnippetHtml(q.code_snippet, q.code_language)}
                                  className="quiz-html mt-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:bg-[#1e1e2e] [&_pre]:border [&_pre]:border-[#313244] [&_pre]:p-4"
                                />
                              )}
                            </div>
                          </div>

                          {!isCorrect && (
                            <div className="text-sm pl-6">
                              <div className="text-orange-600 dark:text-orange-400">
                                <p className="mb-1">Your answer:</p>
                                <div className="quiz-html [&_img]:max-w-full [&_img]:h-auto [&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:bg-[#1e1e2e] [&_pre]:border [&_pre]:border-[#313244] [&_pre]:p-3">
                                  <HighlightedContent html={studentChoice?.text ?? "(no answer)"} />
                                </div>
                              </div>
                            </div>
                          )}
                          {isCorrect && correctChoice && (
                            <div className="text-sm pl-6">
                              <div className="text-green-700 dark:text-green-400 font-medium">
                                <p className="mb-1">Correct answer:</p>
                                <div className="quiz-html [&_img]:max-w-full [&_img]:h-auto [&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:bg-[#1e1e2e] [&_pre]:border [&_pre]:border-[#313244] [&_pre]:p-3">
                                  <HighlightedContent html={correctChoice.text} />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Out of attempts / observer locked message */}
                  {(outOfAttempts || isObserver) && (
                    <div className="text-sm text-muted-text bg-surface border border-border rounded-xl px-5 py-4">
                      {isObserver
                        ? "Quiz submissions are paused while you're on leave."
                        : `You've used all ${maxAttempts} attempt${maxAttempts !== 1 ? "s" : ""}. Correct answers are shown above.`}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
        </div>
      </div>
    </div>
  );
}
