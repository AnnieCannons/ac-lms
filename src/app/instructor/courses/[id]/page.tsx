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
    .select("*, module_days(*, assignments(*), resources(*))")
    .eq("course_id", id)
    .order("order", { ascending: true });

  const { data: testAssignments, error: testErr } = await supabase
    .from("assignments")
    .select("id")
    .limit(1);

  console.log(
    "assignments visible to this user:",
    testAssignments?.length,
    "error:",
    testErr,
  );
  console.log(
    "nested assignments on first module day:",
    modules?.[0]?.module_days?.[0]?.assignments?.length,
  );

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between">
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
            className="text-gray-400 hover:text-teal-primary text-sm"
          >
            ← Courses
          </Link>
          <span className="text-gray-300">/</span>
          <h2 className="text-2xl font-bold text-dark-text">{course.name}</h2>
        </div>
        <p className="text-gray-500 text-sm mb-8">{course.code}</p>

        <CourseEditor course={course} initialModules={modules || []} />
      </main>
    </div>
  );
}
