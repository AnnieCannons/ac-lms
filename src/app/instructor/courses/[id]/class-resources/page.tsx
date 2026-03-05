import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InstructorSidebar from "@/components/ui/InstructorSidebar";
import ResourceOutline from "@/components/ui/ResourceOutline";

export default async function InstructorClassResourcesPage({
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

  const { data: rawModules } = await supabase
    .from("modules")
    .select("id, title, week_number, order, module_days(id, day_name, order, resources(id, type, title, content, description, order))")
    .eq("course_id", id)
    .order("order", { ascending: true });

  const modules = (rawModules ?? []).filter((m: { title?: string | null }) => !m.title?.includes('DO NOT PUBLISH'));

  return (
    <div className="min-h-screen bg-background">
      <nav aria-label="Primary navigation" className="bg-surface border-b border-border px-8 py-4 flex items-center justify-between">
        <Link href="/instructor/courses" className="text-xl font-extrabold text-dark-text">
          AC<span className="text-teal-primary">*</span>
        </Link>
      </nav>

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" className="max-w-4xl mx-auto px-8 py-10">
            <Link href="/instructor/courses" className="text-muted-text hover:text-teal-primary text-sm">
              ← Courses
            </Link>
            <h2 className="text-xl font-bold text-dark-text mt-6 mb-6">Class Resources</h2>
            <ResourceOutline
              modules={modules as Parameters<typeof ResourceOutline>[0]['modules']}
              courseId={id}
              mode="resources"
              editable
            />
          </main>
        </div>
      </div>
    </div>
  );
}
