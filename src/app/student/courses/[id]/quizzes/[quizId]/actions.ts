"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type AnswerInput = { question_ident: string; choice_ident: string };

export async function submitQuiz(formData: FormData) {
  const courseId = formData.get("courseId") as string | null;
  const quizId = formData.get("quizId") as string | null;
  if (!courseId || !quizId) redirect("/student/courses");

  // Parse previous answers (for retake merge)
  let previousAnswers: AnswerInput[] = [];
  const prevRaw = formData.get("previousAnswers");
  if (prevRaw && typeof prevRaw === "string") {
    try {
      previousAnswers = JSON.parse(prevRaw);
    } catch {
      previousAnswers = [];
    }
  }

  // Parse new answers from this submission
  const newAnswers: AnswerInput[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("answer_") && typeof value === "string") {
      const question_ident = key.slice(7);
      if (question_ident && value) {
        newAnswers.push({ question_ident, choice_ident: value });
      }
    }
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .eq("role", "student")
    .maybeSingle();

  if (!enrollment) redirect("/student/courses");

  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select("id, questions, max_attempts")
    .eq("id", quizId)
    .eq("course_id", courseId)
    .eq("published", true)
    .single();

  if (quizError || !quiz) redirect(`/student/courses/${courseId}/quizzes`);

  // Enforce max_attempts
  const { data: existingSub } = await supabase
    .from("quiz_submissions")
    .select("attempt_count")
    .eq("quiz_id", quizId)
    .eq("student_id", user.id)
    .maybeSingle();

  const currentAttemptCount = existingSub?.attempt_count ?? 0;
  const maxAttempts = quiz.max_attempts as number | null;
  if (maxAttempts !== null && currentAttemptCount >= maxAttempts) {
    // Already out of attempts — redirect without saving
    redirect(`/student/courses/${courseId}/quizzes/${quizId}`);
  }

  // Merge: previous correct answers take precedence for questions not in this submission
  // New answers override previous for questions submitted now
  const mergedMap = new Map<string, string>();
  for (const a of previousAnswers) {
    mergedMap.set(a.question_ident, a.choice_ident);
  }
  for (const a of newAnswers) {
    mergedMap.set(a.question_ident, a.choice_ident);
  }
  const mergedAnswers: AnswerInput[] = Array.from(mergedMap.entries()).map(
    ([question_ident, choice_ident]) => ({ question_ident, choice_ident })
  );

  // Compute score from the full merged set
  const questions = (quiz.questions ?? []) as Array<{
    ident: string;
    correct_response_ident: string;
  }>;
  let correct = 0;
  for (const q of questions) {
    const a = mergedMap.get(q.ident);
    if (a === q.correct_response_ident) correct++;
  }
  const scorePercent =
    questions.length > 0 ? Math.round((correct / questions.length) * 100) : null;

  await supabase.from("quiz_submissions").upsert(
    {
      quiz_id: quizId,
      student_id: user.id,
      submitted_at: new Date().toISOString(),
      answers: mergedAnswers,
      score_percent: scorePercent,
      attempt_count: currentAttemptCount + 1,
    },
    { onConflict: "quiz_id,student_id" }
  );

  redirect(`/student/courses/${courseId}/quizzes/${quizId}`);
}
