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
  const { error } = await admin
    .from("quizzes")
    .upsert(
      { course_id: courseId, identifier, ...fields, updated_at: new Date().toISOString() },
      { onConflict: "course_id,identifier" }
    );
  if (error) throw new Error(error.message);
}
