"use server";

import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { linkedDayInCourse } from "@/lib/course-access";
import type { QuizQuestion } from "@/data/quizzes";

async function getAuthedInstructorOrTa(courseId: string): Promise<{ error?: string; code?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated', code: 'NOT_AUTHENTICATED' };
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  // Instructors/staff are globally trusted — any course, no per-course enrollment required.
  if (profile?.role === 'admin' || profile?.role === 'instructor' || profile?.role === 'staff') return {};
  // TA: role='student' in users table but 'ta' in course_enrollments — this is a real, course-scoped boundary.
  const { data: taEnrollment } = await supabase
    .from('course_enrollments')
    .select('role')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .eq('role', 'ta')
    .maybeSingle()
  if (taEnrollment) return {};
  return { error: 'Unauthorized', code: 'NOT_STAFF' };
}

function pickDefined<T extends object, K extends keyof T>(obj: T, keys: K[]): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function throwAuthError(auth: { error?: string; code?: string }): never {
  const e = new Error(auth.error) as Error & { code?: string }
  e.code = auth.code
  throw e
}

export async function createQuizWithQuestions(
  courseId: string,
  title: string,
  questions: QuizQuestion[],
  moduleTitle = '',
  dayTitle: string | null = null,
  linkedDayId: string | null = null
) {
  const auth = await getAuthedInstructorOrTa(courseId)
  if (auth.error) throwAuthError(auth)
  const admin = createServiceSupabaseClient()
  if (!(await linkedDayInCourse(admin, linkedDayId, courseId))) throw new Error('Linked day is not in this course')
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
  const auth = await getAuthedInstructorOrTa(courseId)
  if (auth.error) throwAuthError(auth)
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
  updates: { title?: string; due_at?: string | null; max_attempts?: number | null; module_title?: string; day_title?: string | null; is_practice?: boolean }
) {
  const auth = await getAuthedInstructorOrTa(courseId)
  if (auth.error) throwAuthError(auth)
  const admin = createServiceSupabaseClient();
  const { error } = await admin
    .from("quizzes")
    // Explicit columns only: spreading `updates` would let a caller write course_id,
    // linked_day_id, published, etc. (a TA could move the quiz into another course).
    .update({
      ...pickDefined(updates, ['title', 'due_at', 'max_attempts', 'module_title', 'day_title', 'is_practice']),
      updated_at: new Date().toISOString(),
    })
    .eq("id", quizId)
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
}

export async function updateQuizQuestions(quizId: string, courseId: string, questions: QuizQuestion[]) {
  const auth = await getAuthedInstructorOrTa(courseId)
  if (auth.error) throwAuthError(auth)
  const admin = createServiceSupabaseClient();
  const { error } = await admin
    .from("quizzes")
    .update({ questions, updated_at: new Date().toISOString() })
    .eq("id", quizId)
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
}

export async function toggleQuizPublished(quizId: string, courseId: string, published: boolean) {
  const auth = await getAuthedInstructorOrTa(courseId)
  if (auth.error) throwAuthError(auth)
  const admin = createServiceSupabaseClient();
  const { error } = await admin
    .from("quizzes")
    .update({ published, updated_at: new Date().toISOString() })
    .eq("id", quizId)
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
}

export async function deleteQuiz(quizId: string, courseId: string) {
  const auth = await getAuthedInstructorOrTa(courseId)
  if (auth.error) throwAuthError(auth)
  const admin = createServiceSupabaseClient();
  // Verify quiz belongs to this course
  const { data: quiz } = await admin.from("quizzes").select("id").eq("id", quizId).eq("course_id", courseId).single();
  if (!quiz) throw new Error("Quiz not found in this course");
  // Soft delete — submissions/progress are preserved for the trash page
  const { error } = await admin.from("quizzes").update({ deleted_at: new Date().toISOString() }).eq("id", quizId);
  if (error) throw new Error(error.message);
}

export async function getConductSubmissions(quizId: string, courseId: string) {
  const auth = await getAuthedInstructorOrTa(courseId)
  if (auth.error) throwAuthError(auth)
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
  const auth = await getAuthedInstructorOrTa(courseId)
  if (auth.error) throwAuthError(auth)
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
  const auth = await getAuthedInstructorOrTa(courseId)
  if (auth.error) throwAuthError(auth)
  const admin = createServiceSupabaseClient();
  const { data, error } = await admin
    .from("quizzes")
    .upsert(
      {
        // Build the row from known columns only, so a
        // `fields.course_id` can't redirect the upsert into a course the caller doesn't TA.
        ...pickDefined(fields, ['title', 'due_at', 'module_title', 'published', 'questions', 'max_attempts']),
        course_id: courseId,
        identifier,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "course_id,identifier" }
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
