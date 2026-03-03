import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import CourseEditor from "@/components/layout/CourseEditor";

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
      <nav className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <Link
          href="/instructor/courses"
          className="text-xl font-extrabold text-dark-text"
        >
          AC<span className="text-teal-primary">*</span>
        </Link>
      </nav>

      <main className="max-w-4xl mx-auto px-8 py-12">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/instructor/courses"
            className="text-muted-text hover:text-teal-primary text-sm"
          >
            ← Courses
          </Link>
          <span className="text-border">/</span>
          <h2 className="text-2xl font-bold text-dark-text">{course.name}</h2>
        </div>
        <p className="text-muted-text text-sm mb-8">{course.code}</p>

        <CourseEditor course={course} initialModules={modules || []} />
      </main>
    </div>
  );
}
