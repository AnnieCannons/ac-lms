import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InstructorTopNav from "@/components/ui/InstructorTopNav";
import CourseEditor from "@/components/layout/CourseEditor";
import CourseNameEditor from "@/components/ui/CourseNameEditor";
import InstructorSidebar from "@/components/ui/InstructorSidebar";
import { getInstructorOrTaAccess } from "@/lib/instructor-access";

export default async function CoursePage({
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

  const { data: modules } = await supabase
    .from("modules")
    .select("*, module_days(*, assignments!module_day_id(*))")
    .eq("course_id", id)
    .order("order", { ascending: true });

  const admin = createServiceSupabaseClient();
  const { data: quizzesData } = await admin
    .from("quizzes")
    .select("id, title, questions, published, module_title, day_title, linked_day_id")
    .eq("course_id", id)
    .or("day_title.not.is.null,linked_day_id.not.is.null");

  const courseQuizzes = (quizzesData ?? []) as Array<{
    id: string; title: string; questions: unknown[]; published: boolean; module_title: string; day_title: string; linked_day_id: string | null;
  }>;

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-4 py-6 sm:px-8 sm:py-10 focus:outline-none">
            <div className="mb-6">
              <Link
                href="/instructor/courses"
                className="text-muted-text hover:text-teal-primary text-sm"
              >
                ← Courses
              </Link>
            </div>
            <CourseNameEditor
              courseId={course.id}
              initialName={course.name}
              initialCode={course.code}
            />

            <CourseEditor course={course} initialModules={modules || []} courseQuizzes={courseQuizzes} readOnly={isTa} />
          </main>
        </div>
      </div>
    </div>
  );
}
