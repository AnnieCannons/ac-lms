import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/ui/LogoutButton";

export default async function QuizSubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: quizzes } = await admin
    .from("quizzes")
    .select("id, title, module_title, due_at")
    .eq("course_id", id)
    .order("module_title", { ascending: true })
    .order("title", { ascending: true });

  const quizList = quizzes ?? [];
  const quizIds = quizList.map((q) => q.id);

  const { data: submissions } =
    quizIds.length > 0
      ? await admin
          .from("quiz_submissions")
          .select("id, quiz_id, student_id, submitted_at, score_percent")
          .in("quiz_id", quizIds)
      : { data: [] };

  const studentIds = [...new Set((submissions ?? []).map((s) => s.student_id))];
  const { data: students } =
    studentIds.length > 0
      ? await admin.from("users").select("id, name, email").in("id", studentIds)
      : { data: [] };

  const studentMap = new Map((students ?? []).map((s) => [s.id, s]));
  const submissionsByQuiz = new Map<string, typeof submissions>();
  for (const q of quizList) {
    submissionsByQuiz.set(
      q.id,
      (submissions ?? []).filter((s) => s.quiz_id === q.id)
    );
  }

  const { data: enrollments } = await admin
    .from("course_enrollments")
    .select("user_id")
    .eq("course_id", id)
    .eq("role", "student");

  const totalStudents = enrollments?.length ?? 0;

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <Link href="/instructor/courses" className="text-xl font-extrabold text-dark-text">
          AC<span className="text-teal-primary">*</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {profile?.name} ·{" "}
            <span className="text-teal-primary font-medium capitalize">{profile?.role}</span>
          </span>
          <LogoutButton />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-8 py-12">
        <div className="flex items-center gap-2 text-sm text-muted-text mb-6">
          <Link href="/instructor/courses" className="hover:text-teal-primary">
            Courses
          </Link>
          <span className="text-border">/</span>
          <Link href={`/instructor/courses/${id}`} className="hover:text-teal-primary">
            {course.name}
          </Link>
          <span className="text-border">/</span>
          <span className="text-dark-text font-medium">Quiz submissions</span>
        </div>

        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-dark-text mb-1">Quiz submissions</h1>
            <p className="text-sm text-muted-text">
              {course.name} · {totalStudents} students enrolled
            </p>
          </div>
          <Link
            href={`/instructor/courses/${id}`}
            className="text-sm font-semibold px-4 py-2 rounded-full border border-border text-dark-text hover:border-teal-primary hover:text-teal-primary transition-colors"
          >
            ← Back to course
          </Link>
        </div>

        {quizList.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-12 text-center">
            <p className="text-muted-text">No quizzes in this course yet.</p>
            <Link
              href={`/instructor/courses/${id}`}
              className="inline-block mt-4 text-sm text-teal-primary hover:underline"
            >
              Manage course
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {quizList.map((quiz) => {
              const quizSubmissions = submissionsByQuiz.get(quiz.id) ?? [];
              const displayTitle = quiz.title?.startsWith("Quiz: ")
                ? quiz.title.slice(6)
                : quiz.title;
              return (
                <div
                  key={quiz.id}
                  className="bg-surface rounded-2xl border border-border overflow-hidden"
                >
                  <div className="px-6 py-4 border-b border-border">
                    <h2 className="font-semibold text-dark-text">{displayTitle}</h2>
                    {quiz.module_title && (
                      <p className="text-xs text-muted-text mt-0.5">{quiz.module_title}</p>
                    )}
                    <p className="text-sm text-muted-text mt-1">
                      {quizSubmissions.length} / {totalStudents} submitted
                    </p>
                  </div>
                  {quizSubmissions.length === 0 ? (
                    <div className="px-6 py-8 text-center text-sm text-muted-text">
                      No submissions yet.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {quizSubmissions.map((sub) => {
                        const student = studentMap.get(sub.student_id);
                        return (
                          <li
                            key={sub.id}
                            className="px-6 py-4 flex items-center justify-between gap-4"
                          >
                            <div>
                              <p className="text-sm font-medium text-dark-text">
                                {student?.name ?? "Unknown"}
                              </p>
                              {student?.email && (
                                <p className="text-xs text-muted-text">{student.email}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-text shrink-0">
                              {sub.score_percent != null && (
                                <span className="font-medium text-dark-text">
                                  {Math.round(sub.score_percent)}%
                                </span>
                              )}
                              <span>{formatDate(sub.submitted_at)}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
