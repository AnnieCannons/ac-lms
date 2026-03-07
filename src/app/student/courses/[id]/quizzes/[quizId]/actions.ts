"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type AnswerInput = { question_ident: string; choice_ident: string };

export async function submitQuiz(formData: FormData) {
  const courseId = formData.get("courseId") as string | null;
  const quizId = formData.get("quizId") as string | null;
  if (!courseId || !quizId) redirect("/student/courses");

  const answers: AnswerInput[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("answer_") && typeof value === "string") {
      const question_ident = key.slice(7);
      if (question_ident && value) {
        answers.push({ question_ident, choice_ident: value });
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
    .select("id, questions")
    .eq("id", quizId)
    .eq("course_id", courseId)
    .eq("published", true)
    .single();

  if (quizError || !quiz) redirect(`/student/courses/${courseId}/quizzes`);

  const questions = (quiz.questions ?? []) as Array<{
    ident: string;
    correct_response_ident: string;
  }>;
  let correct = 0;
  for (const q of questions) {
    const a = answers.find((x) => x.question_ident === q.ident);
    if (a && a.choice_ident === q.correct_response_ident) correct++;
  }
  const scorePercent =
    questions.length > 0 ? Math.round((correct / questions.length) * 100) : null;

  await supabase.from("quiz_submissions").upsert(
    {
      quiz_id: quizId,
      student_id: user.id,
      submitted_at: new Date().toISOString(),
      answers,
      score_percent: scorePercent,
    },
    { onConflict: "quiz_id,student_id" }
  );

  redirect(`/student/courses/${courseId}/quizzes?submitted=1`);
}
