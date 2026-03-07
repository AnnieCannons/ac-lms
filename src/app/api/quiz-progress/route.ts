import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { quizId, answers } = await req.json() as { quizId?: string; answers?: unknown[] };
  if (!quizId) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const admin = createServiceSupabaseClient();
  await admin.from("quiz_progress").upsert(
    {
      quiz_id: quizId,
      student_id: user.id,
      answers_json: answers ?? [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "quiz_id,student_id" }
  );

  return NextResponse.json({ ok: true });
}
