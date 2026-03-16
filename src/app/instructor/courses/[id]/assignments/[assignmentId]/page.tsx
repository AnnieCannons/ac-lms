import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InstructorTopNav from "@/components/ui/InstructorTopNav";
import InstructorSidebar from "@/components/ui/InstructorSidebar";
import AssignmentViewEdit from "@/components/ui/AssignmentViewEdit";
import { getInstructorOrTaAccess } from "@/lib/instructor-access";

export default async function InstructorAssignmentEditPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id, assignmentId } = await params;
  const { user, profile, isTa } = await getInstructorOrTaAccess(id);
  const supabase = await createServerSupabaseClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!course) redirect("/instructor/courses");

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, title, description, how_to_turn_in, due_date, published, answer_key_url, submission_required, skill_tags, is_bonus")
    .eq("id", assignmentId)
    .single();

  if (!assignment) redirect(`/instructor/courses/${id}/assignments`);

  const { data: checklist } = await supabase
    .from("checklist_items")
    .select("id, text, description, order, required")
    .eq("assignment_id", assignmentId)
    .order("order", { ascending: true });

  const admin = createServiceSupabaseClient()

  const { data: enrollmentRows } = await supabase
    .from('course_enrollments')
    .select('user_id')
    .eq('course_id', id)
    .eq('role', 'student')

  const studentIds = (enrollmentRows ?? []).map((e: { user_id: string }) => e.user_id)
  const { data: studentRows } = studentIds.length > 0
    ? await admin.from('users').select('id, name').in('id', studentIds).order('name')
    : { data: [] }
  const enrolledStudents = (studentRows ?? []) as { id: string; name: string }[]

  const { data: overrideRows } = await admin
    .from('assignment_overrides')
    .select('id, student_id, due_date, excused')
    .eq('assignment_id', assignmentId)
  const studentMap = new Map(enrolledStudents.map(s => [s.id, s.name]))
  const initialOverrides = (overrideRows ?? []).map((o: { id: string; student_id: string; due_date: string | null; excused: boolean }) => ({
    id: o.id,
    student_id: o.student_id,
    student_name: studentMap.get(o.student_id) ?? 'Unknown',
    due_date: o.due_date,
    excused: o.excused,
  }))

  // Fetch all assignments in module order for prev/next navigation
  const { data: modules } = await supabase
    .from('modules')
    .select('week_number, order, module_days(order, assignments(id, title, order, deleted_at))')
    .eq('course_id', id)
    .order('week_number')

  const orderedAssignments = (modules ?? [])
    .sort((a, b) => a.week_number - b.week_number || a.order - b.order)
    .flatMap(m =>
      [...(m.module_days ?? [])].sort((a: { order: number }, b: { order: number }) => a.order - b.order)
        .flatMap((d: { order: number; assignments: { id: string; title: string; order: number; deleted_at: string | null }[] }) =>
          [...(d.assignments ?? [])]
            .filter(a => !a.deleted_at)
            .sort((a, b) => a.order - b.order)
            .map(a => ({ id: a.id, title: a.title }))
        )
    )

  const currentIndex = orderedAssignments.findIndex(a => a.id === assignmentId)
  const prevAssignment = currentIndex > 0 ? orderedAssignments[currentIndex - 1] : null
  const nextAssignment = currentIndex < orderedAssignments.length - 1 ? orderedAssignments[currentIndex + 1] : null

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} isTa={isTa} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-8 py-10 focus:outline-none">
            <div className="mb-6">
              <Link href={`/instructor/courses/${id}/assignments`} className="text-sm text-muted-text hover:text-teal-primary transition-colors">
                ← Back
              </Link>
            </div>

            <AssignmentViewEdit
              courseId={id}
              assignment={assignment}
              initialChecklist={checklist ?? []}
              enrolledStudents={enrolledStudents}
              initialOverrides={initialOverrides}
              prevAssignment={prevAssignment}
              nextAssignment={nextAssignment}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
