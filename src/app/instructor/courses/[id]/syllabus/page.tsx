import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InstructorTopNav from "@/components/ui/InstructorTopNav";
import CourseEditor from "@/components/layout/CourseEditor";
import InstructorSidebar from "@/components/ui/InstructorSidebar";
import { getInstructorOrTaAccess } from "@/lib/instructor-access";

export const dynamic = 'force-dynamic';

export default async function InstructorSyllabusPage({
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

  function getCurrentWeek(startDate: string | null): number | null {
    if (!startDate) return null
    const diffMs = Date.now() - new Date(startDate).getTime()
    if (diffMs < 0) return null
    return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)) + 1
  }
  const currentWeek = getCurrentWeek(course.start_date ?? null)

  const { data: rawModules } = await admin
    .from("modules")
    .select("*, module_days(*, deleted_at, assignments!module_day_id(*, deleted_at))")
    .eq("course_id", id)
    .is("deleted_at", null)
    .order("order", { ascending: true });

  const modules = (rawModules ?? []).map((m) => ({
    ...m,
    module_days: (m.module_days ?? [])
      .filter((d: { deleted_at?: string | null }) => !d.deleted_at)
      .map((d: { assignments?: Array<{ deleted_at?: string | null }> }) => ({ ...d, assignments: (d.assignments ?? []).filter(a => !a.deleted_at) })),
  }));
  const [{ data: quizzesData }] = await Promise.all([
    admin
      .from("quizzes")
      .select("id, title, questions, published, module_title, day_title")
      .eq("course_id", id)
      .is("deleted_at", null)
      .not("day_title", "is", null),
  ]);

  const courseQuizzes = (quizzesData ?? []) as Array<{
    id: string; title: string; questions: unknown[]; published: boolean; module_title: string; day_title: string;
  }>;

  // Fetch wikis for all modules and days
  const moduleIds = modules.map(m => m.id)
  const dayIds = modules.flatMap(m => m.module_days.map((d: { id: string }) => d.id))
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

  const modulesWithWikis = modules.map(m => ({
    ...m,
    wikis: wikisData.filter(w => w.module_id === m.id),
    module_days: m.module_days.map((d: { id: string }) => ({
      ...d,
      wikis: wikisData.filter(w => w.module_day_id === d.id),
    })),
  }))

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} isTa={isTa} breadcrumbs={[{ label: 'Courses', href: '/instructor/courses' }, { label: course.name, href: `/instructor/courses/${id}` }, { label: 'Course Outline' }]} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-4xl mx-auto px-8 py-10 focus:outline-none">
            <Link href="/instructor/courses" className="text-muted-text hover:text-teal-primary text-sm">
              ← Courses
            </Link>
            <div className="flex items-center gap-3 flex-wrap mt-6 mb-6">
              <h2 className="text-xl font-bold text-dark-text">Course Outline</h2>
              {currentWeek && (
                <a href={`#week-${currentWeek}`} className="text-sm font-semibold bg-purple-light text-purple-primary px-3 py-1 rounded-full hover:opacity-80 transition-opacity">
                  Week {currentWeek} this week
                </a>
              )}
            </div>

            <CourseEditor course={course} initialModules={modulesWithWikis} filterCategory="syllabus" courseQuizzes={courseQuizzes} readOnly={isTa} />
          </main>
        </div>
      </div>
    </div>
  );
}
