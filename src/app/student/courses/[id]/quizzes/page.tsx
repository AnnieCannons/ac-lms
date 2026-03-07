import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/ui/LogoutButton";
import StudentCourseNav from "@/components/ui/StudentCourseNav";

function formatDueDate(dueAt: string | null): string {
  if (!dueAt || !dueAt.trim()) return "No due date";
  try {
    return new Date(dueAt).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dueAt;
  }
}

export default async function StudentQuizzesPage({
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

  if (profile?.role === "instructor" || profile?.role === "admin") {
    redirect(`/instructor/courses/${id}`);
  }

  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("course_id", id)
    .eq("role", "student")
    .maybeSingle();

  if (!enrollment) redirect("/student/courses");

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, code")
    .eq("id", id)
    .single();

  if (!course) redirect("/student/courses");

  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, title, due_at, module_title, questions")
    .eq("course_id", id)
    .eq("published", true)
    .order("module_title", { ascending: true })
    .order("title", { ascending: true });

  const quizList = quizzes ?? [];

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <Link href="/student/courses" className="text-xl font-extrabold text-dark-text">
          AC<span className="text-teal-primary">*</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {profile?.name} · <span className="text-teal-primary font-medium capitalize">{profile?.role}</span>
          </span>
          <LogoutButton />
        </div>
      </nav>

      <div className="flex">
        <aside className="w-56 shrink-0 border-r border-border min-h-[calc(100vh-65px)] py-8 px-3">
          <StudentCourseNav courseId={id} courseName={course.name} />
        </aside>

        <div className="flex-1 min-w-0">
          <main className="max-w-3xl mx-auto px-8 py-10">
            <div className="mb-8">
              <Link href="/student/courses" className="text-muted-text hover:text-teal-primary text-sm mb-2 inline-block">
                ← My Courses
              </Link>
              <h1 className="text-2xl font-bold text-dark-text">Quizzes</h1>
              <p className="text-sm text-muted-text mt-1">{course.name}</p>
            </div>

            {quizList.length === 0 ? (
              <div className="bg-surface rounded-2xl border border-border p-12 text-center">
                <p className="text-muted-text">No published quizzes for this course yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {quizList.map((quiz) => {
                  const displayTitle = quiz.title?.startsWith("Quiz: ") ? quiz.title.slice(6) : quiz.title;
                  const questionCount = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
                  return (
                    <Link
                      key={quiz.id}
                      href={`/student/courses/${id}/quizzes/${quiz.id}`}
                      className="block bg-surface rounded-2xl border border-border p-6 hover:border-teal-primary transition-colors"
                    >
                      <h3 className="font-semibold text-dark-text">{displayTitle}</h3>
                      {quiz.module_title && (
                        <p className="text-xs text-muted-text mt-1">{quiz.module_title}</p>
                      )}
                      <p className="text-sm text-muted-text mt-2">
                        Due: {formatDueDate(quiz.due_at)} · {questionCount} question{questionCount !== 1 ? "s" : ""}
                      </p>
                      <p className="text-teal-primary text-sm font-medium mt-3">
                        Take quiz →
                      </p>
                    </Link>
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
