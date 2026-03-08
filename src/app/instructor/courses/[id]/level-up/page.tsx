import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InstructorTopNav from "@/components/ui/InstructorTopNav";
import CourseEditor from "@/components/layout/CourseEditor";
import InstructorSidebar from "@/components/ui/InstructorSidebar";
import BonusAssignmentList from "@/components/ui/BonusAssignmentList";

export default async function InstructorLevelUpPage({
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

  if (profile?.role !== "instructor" && profile?.role !== "admin") {
    redirect("/unauthorized");
  }

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();

  if (!course) redirect("/instructor/courses");

  const [{ data: modules }, { data: bonusAssignmentsRaw }] = await Promise.all([
    supabase
      .from("modules")
      .select("*, module_days(*, assignments!module_day_id(*))")
      .eq("course_id", id)
      .order("order", { ascending: true }),
    supabase
      .from("assignments")
      .select("id, title, due_date, published, skill_tags, module_day_id, module_days!module_day_id(module_id, modules(course_id, category, title))")
      .eq("is_bonus", true),
  ]);

  // Filter to this course, non-level_up modules
  type BonusAssignment = {
    id: string; title: string; due_date: string | null; published: boolean; skill_tags: string[] | null
    moduleTitle: string | null
  }
  const bonusAssignments: BonusAssignment[] = ((bonusAssignmentsRaw ?? []) as unknown as Array<{
    id: string; title: string; due_date: string | null; published: boolean; skill_tags: string[] | null
    module_days: { module_id: string; modules: { course_id: string; category: string | null; title: string } | null } | null
  }>).filter(a => {
    const mod = Array.isArray(a.module_days) ? (a.module_days as Array<{ modules: { course_id: string; category: string | null } | null }>)[0]?.modules : a.module_days?.modules
    return mod?.course_id === id && mod?.category !== "level_up"
  }).map(a => {
    const mod = Array.isArray(a.module_days) ? (a.module_days as Array<{ modules: { title: string } | null }>)[0]?.modules : (a.module_days as { modules: { title: string } | null } | null)?.modules
    return { id: a.id, title: a.title, due_date: a.due_date, published: a.published, skill_tags: a.skill_tags, moduleTitle: mod?.title ?? null }
  })

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-8 py-10 focus:outline-none">
            <Link href="/instructor/courses" className="text-muted-text hover:text-teal-primary text-sm">
              ← Courses
            </Link>
            <h2 className="text-xl font-bold text-dark-text mt-6 mb-6">Level Up Your Skills</h2>

            <CourseEditor course={course} initialModules={modules || []} filterCategory="level_up" />

            {bonusAssignments.length > 0 && (
              <BonusAssignmentList assignments={bonusAssignments} courseId={id} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
