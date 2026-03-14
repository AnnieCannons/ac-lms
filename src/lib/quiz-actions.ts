"use server";

import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { QuizQuestion } from "@/data/quizzes";

async function getInstructorSession() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role === "student") redirect("/student/courses");
  return user;
}

export async function createQuizWithQuestions(
  courseId: string,
  title: string,
  questions: QuizQuestion[],
  moduleTitle = '',
  dayTitle: string | null = null,
  linkedDayId: string | null = null
) {
  await getInstructorSession()
  const admin = createServiceSupabaseClient()
  const identifier = `paste-${Date.now()}`
  const { data, error } = await admin
    .from('quizzes')
    .insert({
      course_id: courseId,
      identifier,
      title,
      due_at: null,
      module_title: moduleTitle,
      day_title: dayTitle || null,
      linked_day_id: linkedDayId || null,
      published: false,
      questions,
      max_attempts: null,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function createQuiz(courseId: string) {
  await getInstructorSession();
  const admin = createServiceSupabaseClient();
  const identifier = `new-quiz-${Date.now()}`;
  const { data, error } = await admin
    .from("quizzes")
    .insert({
      course_id: courseId,
      identifier,
      title: "New Quiz",
      due_at: null,
      module_title: "",
      published: false,
      questions: [],
      max_attempts: null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateQuizMeta(
  quizId: string,
  courseId: string,
  updates: { title?: string; due_at?: string | null; max_attempts?: number | null; module_title?: string; day_title?: string | null }
) {
  await getInstructorSession();
  const admin = createServiceSupabaseClient();
  const { error } = await admin
    .from("quizzes")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", quizId)
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
}

export async function updateQuizQuestions(quizId: string, courseId: string, questions: QuizQuestion[]) {
  await getInstructorSession();
  const admin = createServiceSupabaseClient();
  const { error } = await admin
    .from("quizzes")
    .update({ questions, updated_at: new Date().toISOString() })
    .eq("id", quizId)
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
}

export async function toggleQuizPublished(quizId: string, courseId: string, published: boolean) {
  await getInstructorSession();
  const admin = createServiceSupabaseClient();
  const { error } = await admin
    .from("quizzes")
    .update({ published, updated_at: new Date().toISOString() })
    .eq("id", quizId)
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
}

export async function deleteQuiz(quizId: string, courseId: string) {
  await getInstructorSession();
  const admin = createServiceSupabaseClient();
  // Verify quiz belongs to this course
  const { data: quiz } = await admin.from("quizzes").select("id").eq("id", quizId).eq("course_id", courseId).single();
  if (!quiz) throw new Error("Quiz not found in this course");
  // Soft delete — submissions/progress are preserved for the trash page
  const { error } = await admin.from("quizzes").update({ deleted_at: new Date().toISOString() }).eq("id", quizId);
  if (error) throw new Error(error.message);
}

export async function getConductSubmissions(quizId: string, courseId: string) {
  await getInstructorSession();
  const admin = createServiceSupabaseClient();
  // Verify quiz belongs to this course
  const { data: quiz } = await admin.from("quizzes").select("id").eq("id", quizId).eq("course_id", courseId).single();
  if (!quiz) throw new Error("Quiz not found in this course");
  const [{ data: submissions, error }, { data: progressRaw }] = await Promise.all([
    admin
      .from("quiz_submissions")
      .select("student_id, score_percent, attempt_count, submitted_at, started_at, attempt_history")
      .eq("quiz_id", quizId),
    admin
      .from("quiz_progress")
      .select("student_id, answers_json, started_at, updated_at")
      .eq("quiz_id", quizId),
  ]);
  if (error) throw new Error(error.message);
  const progress = (progressRaw ?? []).map((r) => ({
    student_id: r.student_id as string,
    answers_count: Array.isArray(r.answers_json) ? (r.answers_json as unknown[]).length : 0,
    started_at: r.started_at as string,
    updated_at: r.updated_at as string,
  }));
  return { submissions: submissions ?? [], progress };
}

export async function updateQuizDay(quizId: string, courseId: string, dayTitle: string | null) {
  await getInstructorSession();
  const admin = createServiceSupabaseClient();
  const { error } = await admin
    .from("quizzes")
    .update({ day_title: dayTitle, updated_at: new Date().toISOString() })
    .eq("id", quizId)
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
}

export async function upsertQuizFromJson(
  courseId: string,
  identifier: string,
  fields: {
    title: string;
    due_at: string | null;
    module_title: string;
    published: boolean;
    questions: QuizQuestion[];
    max_attempts: number | null;
  }
) {
  await getInstructorSession();
  const admin = createServiceSupabaseClient();
  const { data, error } = await admin
    .from("quizzes")
    .upsert(
      { course_id: courseId, identifier, ...fields, updated_at: new Date().toISOString() },
      { onConflict: "course_id,identifier" }
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
