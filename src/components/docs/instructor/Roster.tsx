import { DocH2, DocH3, DocP, DocList, DocTip } from '@/components/docs/DocComponents'

export default function Roster() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Roster & Student Progress</h1>
      <p className="text-sm text-muted-text mb-8">Track individual student progress and grade inline from one view.</p>

      <DocH2>The Accommodation Roster</DocH2>
      <DocP>
        Navigate to <strong>Roster</strong> in the course sidebar to see the accommodation roster. This page lists
        students who have accommodation notes or flags on their profile — useful for instructors coordinating with
        accessibility services.
      </DocP>
      <DocP>
        Each student row shows their accommodation flags. The <strong>camera-off</strong> flag includes a date range — click it to open an editable popover where you can set or update the dates for which the student has a camera-off accommodation. A <strong>Notes</strong> badge appears when additional context has been recorded.
      </DocP>

      <DocH2>Student Progress Overview</DocH2>
      <DocP>
        Click any student&apos;s name in the roster to open their <strong>Student Detail View</strong>. This page
        shows a breakdown of their assignment status across the entire course:
      </DocP>
      <DocList>
        <li><strong>Missing</strong> — assignments that are past due with no submission</li>
        <li><strong>Late</strong> — submissions received after the due date</li>
        <li><strong>Needs Grading</strong> — submitted but not yet graded</li>
        <li><strong>Needs Revision</strong> — graded as incomplete; student should revise</li>
        <li><strong>Complete</strong> — graded as complete</li>
      </DocList>
      <DocP>
        Click any stat card to expand the assignment list for that category. The progress line at the top
        (&ldquo;X / Y assignments complete&rdquo;) updates in real time as you grade.
      </DocP>

      <DocH2>Speed Grading from the Student Detail View</DocH2>
      <DocP>
        When you expand the <strong>Needs Grading</strong> or <strong>Needs Revision</strong> categories, each
        assignment shows inline grade buttons — no need to navigate to the individual submission page.
      </DocP>
      <DocList>
        <li><strong>✓ Complete</strong> — marks the submission as complete; the item moves to the Complete list immediately.</li>
        <li><strong>✗ Revision</strong> — marks the submission as needing revision (only available for Needs Grading items).</li>
        <li><strong>View →</strong> / <strong>Grade →</strong> — opens the full submission page when you need to read the work or leave a comment.</li>
      </DocList>
      <DocTip>
        Use this view during 1-on-1 check-ins to see exactly where a student stands and grade outstanding work on the
        spot without switching pages.
      </DocTip>

      <DocH2>Who Appears on the Roster?</DocH2>
      <DocP>
        The roster shows all students with an active enrollment in the course. Students on observer status also appear
        but are labeled with their observer role.
      </DocP>

      <DocH2>Linking from Roster to Student Detail</DocH2>
      <DocP>
        Student names on the roster page are clickable links that open the student detail view at
        <strong> /roster/[student-id]</strong>. You can share this URL directly with another instructor or TA.
      </DocP>
    </>
  )
}
