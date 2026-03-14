import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type Answer = { question_index: number; choice_ident: string };

function isValidAnswers(value: unknown): value is Answer[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    a => a !== null && typeof a === "object" &&
    typeof (a as Answer).question_index === "number" &&
    typeof (a as Answer).choice_ident === "string"
  );
}

export async function POST(req: NextRequest) {
  const { quizId, answers } = await req.json() as { quizId?: string; answers?: unknown };
  if (!quizId) return NextResponse.json({ ok: false }, { status: 400 });
  if (!isValidAnswers(answers)) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const admin = createServiceSupabaseClient();

  // Verify the quiz exists, is published, and is not trashed
  const { data: quiz } = await admin
    .from("quizzes")
    .select("id, course_id")
    .eq("id", quizId)
    .eq("published", true)
    .is("deleted_at", null)
    .single();

  if (!quiz) return NextResponse.json({ ok: false }, { status: 404 });

  // Verify the user is enrolled in the course (student or observer)
  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", quiz.course_id)
    .in("role", ["student", "observer"])
    .maybeSingle();

  if (!enrollment) return NextResponse.json({ ok: false }, { status: 403 });

  await admin.from("quiz_progress").upsert(
    {
      quiz_id: quizId,
      student_id: user.id,
      answers_json: answers,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "quiz_id,student_id" }
  );

  return NextResponse.json({ ok: true });
}
