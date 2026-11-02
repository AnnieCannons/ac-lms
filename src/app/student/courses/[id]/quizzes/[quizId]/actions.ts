"use server";

import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { isStudentPreview } from "@/lib/student-preview";
import { redirect } from "next/navigation";

// Answers stored by question position so duplicate idents across questions work correctly
export type AnswerEntry = { question_index: number; choice_ident: string };

export async function submitQuiz(formData: FormData) {
  const courseId = formData.get("courseId") as string | null;
  const quizId = formData.get("quizId") as string | null;
  if (!courseId || !quizId) redirect("/student/courses");

  // Instructors in student preview cannot submit — redirect back to quiz page
  const preview = await isStudentPreview(courseId);
  if (preview) redirect(`/student/courses/${courseId}/quizzes/${quizId}`);

  // How many attempts the student had when the page was rendered. A second click on Submit,
  // or a resubmit from a stale tab, carries the same number and is dropped below.
  const attemptCountRaw = formData.get("attemptCount");
  const expectedAttemptCount = typeof attemptCountRaw === "string" && attemptCountRaw !== ""
    ? Number(attemptCountRaw)
    : null;

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
    .select("id, role")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .in("role", ["student", "observer"])
    .maybeSingle();

  if (!enrollment) redirect("/student/courses");

  if (enrollment.role === "observer") {
    return { error: "Quiz submissions are paused while on leave." };
  }

  const admin = createServiceSupabaseClient();

  const { data: quiz, error: quizError } = await admin
    .from("quizzes")
    .select("id, questions, max_attempts, is_practice")
    .eq("id", quizId)
    .eq("course_id", courseId)
    .eq("published", true)
    .is("deleted_at", null)
    .single();

  if (quizError || !quiz) redirect(`/student/courses/${courseId}/quizzes`);

  // Enforce max_attempts; also grab started_at and attempt history
  const { data: existingSub } = await admin
    .from("quiz_submissions")
    .select("attempt_count, attempt_history, answers")
    .eq("quiz_id", quizId)
    .eq("student_id", user.id)
    .maybeSingle();

  // Read when the student started this attempt (from quiz_progress)
  const { data: progressRow } = await admin
    .from("quiz_progress")
    .select("started_at")
    .eq("quiz_id", quizId)
    .eq("student_id", user.id)
    .maybeSingle();

  const currentAttemptCount = existingSub?.attempt_count ?? 0;
  if (expectedAttemptCount !== null && expectedAttemptCount !== currentAttemptCount) {
    redirect(`/student/courses/${courseId}/quizzes/${quizId}`);
  }
  // Practice quizzes are ungraded with unlimited retakes
  const maxAttempts = quiz.is_practice ? null : quiz.max_attempts as number | null;
  if (maxAttempts !== null && currentAttemptCount >= maxAttempts) {
    redirect(`/student/courses/${courseId}/quizzes/${quizId}`);
  }

  // Merge: stored answers from the last attempt + new answers (new overrides by question_index).
  // Read from the database, not the form, so a retake can't claim answers it never gave.
  const previousAnswers: AnswerEntry[] = Array.isArray(existingSub?.answers)
    ? (existingSub.answers as Array<Partial<AnswerEntry>>).filter(
        (a): a is AnswerEntry => typeof a.question_index === "number" && typeof a.choice_ident === "string"
      )
    : [];
  const questions = (quiz.questions ?? []) as Array<{ correct_response_ident: string }>;
  const mergedMap = new Map<number, string>();
  for (const a of previousAnswers) mergedMap.set(a.question_index, a.choice_ident);
  for (const a of newAnswers) mergedMap.set(a.question_index, a.choice_ident);

  // Require every question to have an answer before accepting the submission
  if (mergedMap.size < questions.length) {
    redirect(`/student/courses/${courseId}/quizzes/${quizId}`);
  }

  const mergedAnswers: AnswerEntry[] = Array.from(mergedMap.entries()).map(
    ([question_index, choice_ident]) => ({ question_index, choice_ident })
  );

  // Compute score — lookup by position, not ident
  let correct = 0;
  for (let qi = 0; qi < questions.length; qi++) {
    if (mergedMap.get(qi) === questions[qi].correct_response_ident) correct++;
  }
  const scorePercent =
    questions.length > 0 ? Math.round((correct / questions.length) * 100) : null;

  const submittedAt = new Date().toISOString();
  const startedAt = progressRow?.started_at ?? null;

  // Append this attempt's timing to the history
  type AttemptRecord = { attempt: number; started_at: string | null; submitted_at: string; score_percent: number | null };
  const prevHistory: AttemptRecord[] = Array.isArray(existingSub?.attempt_history)
    ? (existingSub.attempt_history as AttemptRecord[])
    : [];
  const attemptHistory: AttemptRecord[] = [
    ...prevHistory,
    { attempt: currentAttemptCount + 1, started_at: startedAt, submitted_at: submittedAt, score_percent: scorePercent },
  ];

  const row = {
    submitted_at: submittedAt,
    started_at: startedAt,
    answers: mergedAnswers,
    score_percent: scorePercent,
    attempt_count: currentAttemptCount + 1,
    attempt_history: attemptHistory,
  };

  // Only write if nobody else has counted an attempt since we read: the first attempt inserts
  // (the unique key rejects a twin), later ones update only from the count we started with.
  // Two overlapping submits then record one attempt, not two.
  if (!existingSub) {
    const { error } = await admin
      .from("quiz_submissions")
      .insert({ quiz_id: quizId, student_id: user.id, ...row });
    if (error) redirect(`/student/courses/${courseId}/quizzes/${quizId}`);
  } else {
    const { data: updated } = await admin
      .from("quiz_submissions")
      .update(row)
      .eq("quiz_id", quizId)
      .eq("student_id", user.id)
      .eq("attempt_count", currentAttemptCount)
      .select("id");
    if (!updated?.length) redirect(`/student/courses/${courseId}/quizzes/${quizId}`);
  }

  // Clear saved progress now that a real submission exists
  await admin.from("quiz_progress").delete().eq("quiz_id", quizId).eq("student_id", user.id);

  redirect(`/student/courses/${courseId}/quizzes/${quizId}`);
}
