import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import CourseEditor from "@/components/layout/CourseEditor";
import CourseNameEditor from "@/components/ui/CourseNameEditor";
import InstructorSidebar from "@/components/ui/InstructorSidebar";
import LaunchSetupButton from "@/components/ui/LaunchSetupButton";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "instructor" && profile?.role !== "admin") {
    redirect("/unauthorized");
  }

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();

  if (!course) redirect("/instructor/courses");

  const { data: modules } = await supabase
    .from("modules")
    .select("*, module_days(*, assignments(*))")
    .eq("course_id", id)
    .order("order", { ascending: true });

  return (
    <div className="min-h-screen bg-background">
      <nav aria-label="Primary navigation" className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <Link
          href="/instructor/courses"
          className="text-xl font-extrabold text-dark-text"
        >
          AC<span className="text-teal-primary">*</span>
        </Link>
      </nav>

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <main id="main-content" className="max-w-4xl mx-auto px-8 py-10">
            <div className="flex items-center justify-between gap-3 mb-6">
              <Link
                href="/instructor/courses"
                className="text-muted-text hover:text-teal-primary text-sm"
              >
                ← Courses
              </Link>
              <LaunchSetupButton courseId={id} />
            </div>
            <CourseNameEditor
              courseId={course.id}
              initialName={course.name}
              initialCode={course.code}
            />

            <CourseEditor course={course} initialModules={modules || []} />
          </main>
        </div>
      </div>
    </div>
  );
}
