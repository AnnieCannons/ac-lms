import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InstructorTopNav from "@/components/ui/InstructorTopNav";
import CourseEditor from "@/components/layout/CourseEditor";
import InstructorSidebar from "@/components/ui/InstructorSidebar";
import { getInstructorOrTaAccess } from "@/lib/instructor-access";

export default async function InstructorCareerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, profile, isTa } = await getInstructorOrTaAccess(id);
  const supabase = await createServerSupabaseClient();
  const admin = createServiceSupabaseClient();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();

  if (!course) redirect("/instructor/courses");

  const { data: modulesRaw } = await admin
    .from("modules")
    .select("*, module_days(*, assignments!module_day_id(*))")
    .eq("course_id", id)
    .order("order", { ascending: true });

  // Fetch wikis linked to this course's modules and days
  const moduleIds = (modulesRaw ?? []).map(m => m.id)
  const dayIds = (modulesRaw ?? []).flatMap(m => (m.module_days ?? []).map((d: { id: string }) => d.id))

  type WikiRow = { id: string; title: string; content: string; published: boolean; order: number; module_id: string | null; module_day_id: string | null }
  let wikisData: WikiRow[] = []

  if (moduleIds.length > 0 || dayIds.length > 0) {
    const orParts: string[] = []
    if (moduleIds.length > 0) orParts.push(`module_id.in.(${moduleIds.join(',')})`)
    if (dayIds.length > 0) orParts.push(`module_day_id.in.(${dayIds.join(',')})`)
    const { data: wRows } = await admin
      .from('wikis')
      .select('id, title, content, published, order, module_id, module_day_id')
      .or(orParts.join(','))
      .order('order', { ascending: true })
    wikisData = (wRows ?? []) as WikiRow[]
  }

  // Inject wikis into modules
  const modules = (modulesRaw ?? []).map(m => ({
    ...m,
    wikis: wikisData.filter(w => w.module_id === m.id),
    module_days: (m.module_days ?? []).map((d: { id: string }) => ({
      ...d,
      wikis: wikisData.filter(w => w.module_day_id === d.id),
    })),
  }));

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} isTa={isTa} breadcrumbs={[{ label: 'Courses', href: '/instructor/courses' }, { label: course.name, href: `/instructor/courses/${id}` }, { label: 'Career Development' }]} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-8 py-10 focus:outline-none">
            <Link href="/instructor/courses" className="text-muted-text hover:text-teal-primary text-sm">
              ← Courses
            </Link>
            <h2 className="text-xl font-bold text-dark-text mt-6 mb-6">Career Development</h2>
            <CourseEditor course={course} initialModules={modules || []} filterCategory="career" readOnly={isTa} />
          </main>
        </div>
      </div>
    </div>
  );
}
