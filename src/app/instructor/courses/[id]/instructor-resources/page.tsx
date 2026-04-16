import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InstructorTopNav from "@/components/ui/InstructorTopNav";
import InstructorSidebar from "@/components/ui/InstructorSidebar";
import ResourceOutline from "@/components/ui/ResourceOutline";
import AddResourceButton from "@/components/ui/AddResourceButton";
import { getInstructorOrTaAccess } from "@/lib/instructor-access";

export const dynamic = 'force-dynamic';

export default async function InstructorResourcesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile, isTa } = await getInstructorOrTaAccess(id);
  const admin = createServiceSupabaseClient();

  const { data: course } = await admin
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();

  if (!course) redirect("/instructor/courses");

  const { data: rawModules } = await admin
    .from("modules")
    .select("id, title, week_number, order, module_days(id, day_name, order, deleted_at, resources!module_day_id(id, type, title, content, description, order, deleted_at, instructor_only))")
    .eq("course_id", id)
    .is("deleted_at", null)
    .order("order", { ascending: true });

  const modules = (rawModules ?? [])
    .filter((m) => !m.title?.includes('DO NOT PUBLISH'))
    .map((m) => ({
      ...m,
      module_days: (m.module_days ?? [])
        .filter(d => !(d as { deleted_at?: string | null }).deleted_at)
        .map(d => ({
          ...d,
          resources: (d.resources ?? []).filter(
            (r: { deleted_at?: string | null; instructor_only?: boolean }) =>
              !r.deleted_at && r.instructor_only === true
          ),
        })),
    }));

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav
        name={profile?.name}
        role={profile?.role}
        isTa={isTa}
        breadcrumbs={[
          { label: 'Courses', href: '/instructor/courses' },
          { label: course.name, href: `/instructor/courses/${id}` },
          { label: 'Instructor Resources' },
        ]}
      />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-8 py-10 focus:outline-none">
            <Link href="/instructor/courses" className="text-muted-text hover:text-teal-primary text-sm">
              ← Courses
            </Link>
            <div className="flex items-center justify-between mt-6 mb-6">
              <div>
                <h2 className="text-xl font-bold text-dark-text">Instructor Resources</h2>
                <p className="text-sm text-muted-text mt-1">Only visible to instructors, admins, and TAs — never shown to students.</p>
              </div>
              {!isTa && <AddResourceButton courseId={id} instructorOnly />}
            </div>
            <ResourceOutline
              modules={modules as Parameters<typeof ResourceOutline>[0]['modules']}
              courseId={id}
              mode="resources"
              editable={!isTa}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
