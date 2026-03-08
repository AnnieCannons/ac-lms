import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InstructorTopNav from "@/components/ui/InstructorTopNav";
import InstructorSidebar from "@/components/ui/InstructorSidebar";
import { getInstructorOrTaAccess } from "@/lib/instructor-access";

export default async function QuizSubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, profile, isTa } = await getInstructorOrTaAccess(id);

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
          .select("id, quiz_id, student_id, submitted_at, score_percent, attempt_count")
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
      <InstructorTopNav name={profile?.name} role={profile?.role} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-6 sm:px-8 sm:py-10 focus:outline-none">
            <div className="flex items-center justify-between mb-6">
              <Link
                href={`/instructor/courses/${id}/quizzes`}
                className="text-muted-text hover:text-teal-primary text-sm"
              >
                ← Quizzes
              </Link>
            </div>

            <div className="mb-8">
              <h1 className="text-2xl font-bold text-dark-text mb-1">Quiz Submissions</h1>
              <p className="text-sm text-muted-text">
                {course.name} · {totalStudents} students enrolled
              </p>
            </div>

            {quizList.length === 0 ? (
              <div className="bg-surface rounded-2xl border border-border p-12 text-center">
                <p className="text-muted-text">No quizzes in this course yet.</p>
                <Link
                  href={`/instructor/courses/${id}/quizzes`}
                  className="inline-block mt-4 text-sm text-teal-primary hover:underline"
                >
                  Manage quizzes
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
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left px-6 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide">Student</th>
                              <th className="text-left px-6 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide">Score</th>
                              <th className="text-left px-6 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide">Attempts</th>
                              <th className="text-left px-6 py-2 text-xs font-semibold text-muted-text uppercase tracking-wide">Submitted</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {quizSubmissions.map((sub) => {
                              const student = studentMap.get(sub.student_id);
                              return (
                                <tr key={sub.id}>
                                  <td className="px-6 py-4">
                                    <p className="font-medium text-dark-text">
                                      {student?.name ?? "Unknown"}
                                    </p>
                                    {student?.email && (
                                      <p className="text-xs text-muted-text">{student.email}</p>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-dark-text">
                                    {sub.score_percent != null
                                      ? `${Math.round(sub.score_percent)}%`
                                      : "—"}
                                  </td>
                                  <td className="px-6 py-4 text-muted-text">
                                    {sub.attempt_count ?? 1}
                                  </td>
                                  <td className="px-6 py-4 text-muted-text">
                                    {formatDate(sub.submitted_at)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
