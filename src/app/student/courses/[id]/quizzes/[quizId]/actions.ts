"use server";

import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Answers stored by question position so duplicate idents across questions work correctly
export type AnswerEntry = { question_index: number; choice_ident: string };

export async function submitQuiz(formData: FormData) {
  const courseId = formData.get("courseId") as string | null;
  const quizId = formData.get("quizId") as string | null;
  if (!courseId || !quizId) redirect("/student/courses");

  // Parse previous answers (for retake merge)
  let previousAnswers: AnswerEntry[] = [];
  const prevRaw = formData.get("previousAnswers");
  if (prevRaw && typeof prevRaw === "string") {
    try {
      previousAnswers = JSON.parse(prevRaw);
    } catch {
      previousAnswers = [];
    }
  }

  // Parse new answers — name="answer_i" where i is the original question index
  const newAnswers: AnswerEntry[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("answer_") && typeof value === "string" && value) {
      const origIdx = parseInt(key.slice(7));
      if (!isNaN(origIdx)) {
        newAnswers.push({ question_index: origIdx, choice_ident: value });
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

  const admin = createServiceSupabaseClient();

  const { data: quiz, error: quizError } = await admin
    .from("quizzes")
    .select("id, questions, max_attempts")
    .eq("id", quizId)
    .eq("course_id", courseId)
    .eq("published", true)
    .single();

  if (quizError || !quiz) redirect(`/student/courses/${courseId}/quizzes`);

  // Enforce max_attempts
  const { data: existingSub } = await admin
    .from("quiz_submissions")
    .select("attempt_count")
    .eq("quiz_id", quizId)
    .eq("student_id", user.id)
    .maybeSingle();

  const currentAttemptCount = existingSub?.attempt_count ?? 0;
  const maxAttempts = quiz.max_attempts as number | null;
  if (maxAttempts !== null && currentAttemptCount >= maxAttempts) {
    redirect(`/student/courses/${courseId}/quizzes/${quizId}`);
  }

  // Merge: previous answers + new answers (new overrides by question_index)
  const mergedMap = new Map<number, string>();
  for (const a of previousAnswers) mergedMap.set(a.question_index, a.choice_ident);
  for (const a of newAnswers) mergedMap.set(a.question_index, a.choice_ident);

  const mergedAnswers: AnswerEntry[] = Array.from(mergedMap.entries()).map(
    ([question_index, choice_ident]) => ({ question_index, choice_ident })
  );

  // Compute score — lookup by position, not ident
  const questions = (quiz.questions ?? []) as Array<{ correct_response_ident: string }>;
  let correct = 0;
  for (let qi = 0; qi < questions.length; qi++) {
    if (mergedMap.get(qi) === questions[qi].correct_response_ident) correct++;
  }
  const scorePercent =
    questions.length > 0 ? Math.round((correct / questions.length) * 100) : null;

  await admin.from("quiz_submissions").upsert(
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
