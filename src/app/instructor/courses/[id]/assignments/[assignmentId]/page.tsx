import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InstructorTopNav from "@/components/ui/InstructorTopNav";
import InstructorSidebar from "@/components/ui/InstructorSidebar";
import AssignmentEditor from "@/components/ui/AssignmentEditor";

export default async function InstructorAssignmentEditPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id, assignmentId } = await params;
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
    .select("id, name")
    .eq("id", id)
    .single();

  if (!course) redirect("/instructor/courses");

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, title, description, how_to_turn_in, due_date, published, answer_key_url, submission_required")
    .eq("id", assignmentId)
    .single();

  if (!assignment) redirect(`/instructor/courses/${id}/assignments`);

  const { data: checklist } = await supabase
    .from("checklist_items")
    .select("id, text, description, order, required")
    .eq("assignment_id", assignmentId)
    .order("order", { ascending: true });

  return (
    <div className="min-h-screen bg-background">
      <InstructorTopNav name={profile?.name} role={profile?.role} />

      <div className="flex">
        <InstructorSidebar courseId={id} courseName={course.name} />

        <div className="flex-1 min-w-0">
          <main id="main-content" className="max-w-3xl mx-auto px-8 py-10">
            <div className="flex items-center gap-2 text-sm text-muted-text mb-6 flex-wrap">
              <Link href={`/instructor/courses/${id}/assignments`} className="hover:text-teal-primary">
                Assignments
              </Link>
              <span className="text-border">/</span>
              <span className="text-dark-text font-medium truncate max-w-xs">{assignment.title}</span>
            </div>

            <div className="flex items-center justify-between gap-4 mb-8">
              <h2 className="text-xl font-bold text-dark-text">Edit Assignment</h2>
              <Link
                href={`/instructor/courses/${id}/assignments/${assignmentId}/submissions`}
                className="text-sm text-teal-primary font-semibold hover:underline"
              >
                View Submissions →
              </Link>
            </div>

            <AssignmentEditor
              courseId={id}
              assignment={assignment}
              initialChecklist={checklist ?? []}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
