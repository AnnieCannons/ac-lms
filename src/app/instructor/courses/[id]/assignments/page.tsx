import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InstructorTopNav from "@/components/ui/InstructorTopNav";
import InstructorSidebar from "@/components/ui/InstructorSidebar";
import ResourceOutline from "@/components/ui/ResourceOutline";
import AddAssignmentButton from "@/components/ui/AddAssignmentButton";
import { getInstructorOrTaAccess } from "@/lib/instructor-access";

export default async function InstructorAssignmentsPage({
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

  const { data: rawModules } = await supabase
    .from("modules")
    .select("id, title, week_number, order, category, module_days(id, day_name, order, deleted_at, assignments!module_day_id(id, title, due_date, published, deleted_at))")
    .eq("course_id", id)
    .is("deleted_at", null)
    .order("order", { ascending: true });

  const modules = (rawModules ?? [])
    .filter((m) => !m.title?.includes('DO NOT PUBLISH'))
    .sort((a, b) => {
      const aCareer = a.category === 'career'
      const bCareer = b.category === 'career'
      if (aCareer !== bCareer) return aCareer ? 1 : -1
      return a.order - b.order
    })
    .map((m) => ({
      ...m,
      module_days: (m.module_days ?? [])
        .filter(d => !(d as { deleted_at?: string | null }).deleted_at)
        .map(d => ({ ...d, assignments: (d.assignments ?? []).filter((a: { deleted_at?: string | null }) => !a.deleted_at) })),
    }));

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} isTa={isTa} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-8 py-10 focus:outline-none">
            <Link href="/instructor/courses" className="text-muted-text hover:text-teal-primary text-sm">
              ← Courses
            </Link>
            <div className="flex items-center justify-between mt-6 mb-6">
              <h2 className="text-xl font-bold text-dark-text">Assignments</h2>
              <AddAssignmentButton courseId={id} />
            </div>
            <ResourceOutline
              modules={modules as Parameters<typeof ResourceOutline>[0]['modules']}
              courseId={id}
              mode="assignments"
              instructorView
            />
          </main>
        </div>
      </div>
    </div>
  );
}
