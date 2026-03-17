import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InstructorTopNav from "@/components/ui/InstructorTopNav";
import CourseEditor from "@/components/layout/CourseEditor";
import InstructorSidebar from "@/components/ui/InstructorSidebar";
import { getInstructorOrTaAccess } from "@/lib/instructor-access";

export const dynamic = 'force-dynamic';

export default async function InstructorSyllabusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, profile, isTa } = await getInstructorOrTaAccess(id);
  const supabase = await createServerSupabaseClient();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();

  if (!course) redirect("/instructor/courses");

  function getCurrentWeek(startDate: string | null): number | null {
    if (!startDate) return null
    const diffMs = Date.now() - new Date(startDate).getTime()
    if (diffMs < 0) return null
    return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)) + 1
  }
  const currentWeek = getCurrentWeek(course.start_date ?? null)

  const { data: rawModules } = await supabase
    .from("modules")
    .select("*, module_days(*, deleted_at, assignments!module_day_id(*, deleted_at))")
    .eq("course_id", id)
    .is("deleted_at", null)
    .order("order", { ascending: true });

  const modules = (rawModules ?? []).map((m) => ({
    ...m,
    module_days: (m.module_days ?? [])
      .filter((d: { deleted_at?: string | null }) => !d.deleted_at)
      .map((d: { assignments?: Array<{ deleted_at?: string | null }> }) => ({ ...d, assignments: (d.assignments ?? []).filter(a => !a.deleted_at) })),
  }));

  const admin = createServiceSupabaseClient();
  const { data: quizzesData } = await admin
    .from("quizzes")
    .select("id, title, questions, published, module_title, day_title")
    .eq("course_id", id)
    .is("deleted_at", null)
    .not("day_title", "is", null);

  const courseQuizzes = (quizzesData ?? []) as Array<{
    id: string; title: string; questions: unknown[]; published: boolean; module_title: string; day_title: string;
  }>;

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} isTa={isTa} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-8 py-10 focus:outline-none">
            <Link href="/instructor/courses" className="text-muted-text hover:text-teal-primary text-sm">
              ← Courses
            </Link>
            <div className="flex items-center gap-3 flex-wrap mt-6 mb-6">
              <h2 className="text-xl font-bold text-dark-text">Course Outline</h2>
              {currentWeek && (
                <span className="text-sm font-semibold bg-purple-light text-purple-primary px-3 py-1 rounded-full">
                  Week {currentWeek} this week
                </span>
              )}
            </div>

            <CourseEditor course={course} initialModules={modules || []} filterCategory="syllabus" courseQuizzes={courseQuizzes} readOnly={isTa} />
          </main>
        </div>
      </div>
    </div>
  );
}
