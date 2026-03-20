import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InstructorTopNav, { type Breadcrumb } from "@/components/ui/InstructorTopNav";
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
  const admin = createServiceSupabaseClient();

  const [{ data: course }, { data: modules }, { data: quizzesData }] = await Promise.all([
    supabase.from("courses").select("id, name, code, start_date").eq("id", id).single(),
    admin.from("modules")
      .select("*, module_days(*, assignments!module_day_id(*))")
      .eq("course_id", id)
      .is("deleted_at", null)
      .order("order", { ascending: true }),
    admin.from("quizzes")
      .select("id, title, questions, published, module_title, day_title, linked_day_id")
      .eq("course_id", id)
      .is("deleted_at", null)
      .or("day_title.not.is.null,linked_day_id.not.is.null"),
  ]);

  if (!course) redirect("/instructor/courses");

  function getCurrentWeek(startDate: string | null): number | null {
    if (!startDate) return null
    const diffMs = Date.now() - new Date(startDate).getTime()
    if (diffMs < 0) return null
    return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)) + 1
  }
  const currentWeek = getCurrentWeek(course.start_date ?? null)

  // Filter out soft-deleted nested items
  const filteredModules = (modules ?? []).map(m => ({
    ...m,
    module_days: (m.module_days ?? [])
      .filter((d: { deleted_at: string | null }) => !d.deleted_at)
      .map((d: { assignments?: Array<{ deleted_at: string | null }> }) => ({
        ...d,
        assignments: (d.assignments ?? []).filter(a => !a.deleted_at),
      })),
  }));

  // Fetch wikis linked to this course's modules and days
  const moduleIds = filteredModules.map(m => m.id)
  const dayIds = filteredModules.flatMap(m => m.module_days.map((d: { id: string }) => d.id))

  type WikiRow = { id: string; title: string; content: string; published: boolean; order: number; module_id: string | null; module_day_id: string | null }
  let wikisData: WikiRow[] = []

  if (moduleIds.length > 0 || dayIds.length > 0) {
    const orParts: string[] = []
    if (moduleIds.length > 0) orParts.push(`module_id.in.(${moduleIds.join(',')})`)
    if (dayIds.length > 0) orParts.push(`module_day_id.in.(${dayIds.join(',')})`)
    const { data: wRows, error: wikiErr } = await admin
      .from('wikis')
      .select('id, title, content, published, order, module_id, module_day_id')
      .or(orParts.join(','))
      .order('order', { ascending: true })
    if (wikiErr) console.error('[page] wiki fetch error:', wikiErr.message)
    wikisData = (wRows ?? []) as WikiRow[]
  }

  // Inject wikis into filteredModules
  const filteredModulesWithWikis = filteredModules.map(m => ({
    ...m,
    wikis: wikisData.filter(w => w.module_id === m.id),
    module_days: m.module_days.map((d: { id: string }) => ({
      ...d,
      wikis: wikisData.filter(w => w.module_day_id === d.id),
    })),
  }));

  const courseQuizzes = (quizzesData ?? []) as Array<{
    id: string; title: string; questions: unknown[]; published: boolean; module_title: string; day_title: string; linked_day_id: string | null;
  }>;

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} isTa={isTa} breadcrumbs={[{ label: 'Courses', href: '/instructor/courses' }, { label: course.name }]} />

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
              currentWeek={currentWeek}
            />

            <CourseEditor course={course} initialModules={filteredModulesWithWikis} courseQuizzes={courseQuizzes} readOnly={isTa} />
          </main>
        </div>
      </div>
    </div>
  );
}
