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
  updates: { title?: string; due_at?: string | null; max_attempts?: number | null }
) {
  await getInstructorSession();
  const admin = createServiceSupabaseClient();
  const { error } = await admin
    .from("quizzes")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", quizId);
  if (error) throw new Error(error.message);
}

export async function updateQuizQuestions(quizId: string, questions: QuizQuestion[]) {
  await getInstructorSession();
  const admin = createServiceSupabaseClient();
  const { error } = await admin
    .from("quizzes")
    .update({ questions, updated_at: new Date().toISOString() })
    .eq("id", quizId);
  if (error) throw new Error(error.message);
}

export async function toggleQuizPublished(quizId: string, published: boolean) {
  await getInstructorSession();
  const admin = createServiceSupabaseClient();
  const { error } = await admin
    .from("quizzes")
    .update({ published, updated_at: new Date().toISOString() })
    .eq("id", quizId);
  if (error) throw new Error(error.message);
}

export async function deleteQuiz(quizId: string) {
  await getInstructorSession();
  const admin = createServiceSupabaseClient();
  // Delete related records first
  await admin.from("quiz_submissions").delete().eq("quiz_id", quizId);
  await admin.from("quiz_progress").delete().eq("quiz_id", quizId);
  const { error } = await admin.from("quizzes").delete().eq("id", quizId);
  if (error) throw new Error(error.message);
}

export async function getConductSubmissions(quizId: string) {
  await getInstructorSession();
  const admin = createServiceSupabaseClient();
  const [{ data: submissions, error }, { data: progressRaw }] = await Promise.all([
    admin
      .from("quiz_submissions")
      .select("student_id, score_percent, attempt_count, submitted_at")
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
