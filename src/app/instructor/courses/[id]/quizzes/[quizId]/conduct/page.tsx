import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InstructorTopNav from "@/components/ui/InstructorTopNav";
import InstructorSidebar from "@/components/ui/InstructorSidebar";
import ConductView from "./ConductView";

export default async function ConductQuizPage({
  params,
}: {
  params: Promise<{ id: string; quizId: string }>;
}) {
  const { id, quizId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "student") redirect("/student/courses");

  let admin: ReturnType<typeof createServiceSupabaseClient>;
  try {
    admin = createServiceSupabaseClient();
  } catch {
    redirect("/instructor/courses");
  }

  const { data: course } = await admin
    .from("courses")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!course) redirect("/instructor/courses");

  const { data: quiz } = await admin
    .from("quizzes")
    .select("id, title, questions, max_attempts, published")
    .eq("id", quizId)
    .eq("course_id", id)
    .single();

  if (!quiz) redirect(`/instructor/courses/${id}/quizzes`);
  if (!quiz.published) redirect(`/instructor/courses/${id}/quizzes?open=${quizId}`);

  // Get all enrolled students
  const { data: enrollments } = await admin
    .from("course_enrollments")
    .select("user_id")
    .eq("course_id", id)
    .eq("role", "student");

  const studentIds = (enrollments ?? []).map((e) => e.user_id);
  const { data: studentRows } =
    studentIds.length > 0
      ? await admin.from("users").select("id, name, email").in("id", studentIds)
      : { data: [] };

  const students = (studentRows ?? []).sort((a, b) => a.name.localeCompare(b.name));

  const totalQuestions = (quiz.questions as unknown[])?.length ?? 0;

  // Get current submissions and progress
  const [{ data: submissionsRaw }, { data: progressRaw }] = await Promise.all([
    admin
      .from("quiz_submissions")
      .select("student_id, score_percent, attempt_count, submitted_at, started_at, attempt_history")
      .eq("quiz_id", quizId),
    admin
      .from("quiz_progress")
      .select("student_id, answers_json, started_at, updated_at")
      .eq("quiz_id", quizId),
  ]);

  const initialProgress = (progressRaw ?? []).map((r) => ({
    student_id: r.student_id as string,
    answers_count: Array.isArray(r.answers_json) ? (r.answers_json as unknown[]).length : 0,
    started_at: r.started_at as string,
    updated_at: r.updated_at as string,
  }));

  const displayTitle = quiz.title?.startsWith("Quiz: ") ? quiz.title.slice(6) : quiz.title;

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} breadcrumbs={[{ label: 'Courses', href: '/instructor/courses' }, { label: course.name, href: `/instructor/courses/${id}` }, { label: 'Quizzes', href: `/instructor/courses/${id}/quizzes` }, { label: quiz.title }]} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-6 sm:px-8 sm:py-10 focus:outline-none">
            <div className="mb-6">
              <Link
                href={`/instructor/courses/${id}/quizzes?open=${quizId}`}
                className="text-muted-text hover:text-teal-primary text-sm"
              >
                ← Back to quiz
              </Link>
            </div>

            <div className="mb-6">
              <h1 className="text-2xl font-bold text-dark-text">{displayTitle}</h1>
              <p className="text-sm text-muted-text mt-1">
                {students.length} students enrolled · {totalQuestions} question{totalQuestions !== 1 ? "s" : ""}
              </p>
            </div>

            <ConductView
              quizId={quizId}
              courseId={id}
              students={students}
              initialSubmissions={submissionsRaw ?? []}
              initialProgress={initialProgress}
              totalQuestions={totalQuestions}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
