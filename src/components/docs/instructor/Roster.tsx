import { DocH2, DocH3, DocP, DocList, DocTip, DocNote } from '@/components/docs/DocComponents'

export default function Roster() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Roster &amp; Student Progress</h1>
      <p className="text-sm text-muted-text mb-8">Track individual student progress and grade inline from one view.</p>

      <DocH2>The Accommodation Roster</DocH2>
      <DocP>
        Navigate to <strong>Roster</strong> in the course sidebar to see the accommodation roster. This page lists
        students who have accommodation notes or flags on their profile — useful for coordinating with accessibility
        services and making sure every student has what they need.
      </DocP>
      <DocP>
        Each student row shows their accommodation flags:
      </DocP>
      <DocList>
        <li><strong>Camera Off</strong> — the student has a camera-off accommodation. Click the badge to open an editable popover where you can set or update the date range for this accommodation.</li>
        <li><strong>Notes</strong> — additional context has been recorded on the student&apos;s profile</li>
      </DocList>

      <DocH2>Student Progress Overview</DocH2>
      <DocP>
        Click any student&apos;s name in the roster to open their <strong>Student Detail View</strong>. This page
        gives you a complete picture of where that student stands across the entire course, with five color-coded
        categories:
      </DocP>
      <DocList>
        <li><strong>Missing</strong> (red) — past-due assignments with no submission. Only counts assignments that were tracked in Canvas, so this number matches what Canvas would report.</li>
        <li><strong>Late</strong> (amber) — submissions received after the due date. An assignment can be both Late and in another category (e.g., Late + Complete).</li>
        <li><strong>Needs Grading</strong> (teal) — submitted and waiting for your review</li>
        <li><strong>Needs Revision</strong> (orange) — you graded as Incomplete; the student should revise and resubmit</li>
        <li><strong>Complete</strong> (green) — graded as complete</li>
      </DocList>
      <DocP>
        Click any stat card to expand the full list of assignments in that category. The progress line at the top
        (&ldquo;X / Y assignments complete&rdquo;) updates immediately as you grade.
      </DocP>
      <DocNote>
        The denominator (Y) reflects all published assignments that the student has an active status on — missing,
        submitted, needing revision, or complete. It excludes assignments the student hasn&apos;t started yet and
        that aren&apos;t past due.
      </DocNote>

      <DocH2>Speed Grading from the Student Detail View</DocH2>
      <DocP>
        When you expand the <strong>Needs Grading</strong> or <strong>Needs Revision</strong> categories, each
        assignment shows inline grade buttons — no need to navigate to the individual submission page.
      </DocP>
      <DocList>
        <li><strong>✓ Complete</strong> — marks the submission as complete; the item moves to the Complete list immediately</li>
        <li><strong>✗ Revision</strong> — marks as needing revision (available for Needs Grading items only)</li>
        <li><strong>View</strong> / <strong>Grade →</strong> — opens the full submission page when you need to read the work or leave a comment before grading</li>
      </DocList>
      <DocTip>
        Use this view during 1-on-1 check-ins to see exactly where a student stands and grade outstanding work on the
        spot without switching pages.
      </DocTip>

      <DocH2>Accessing Student Detail</DocH2>
      <DocP>
        The Student Detail View is accessible from two places:
      </DocP>
      <DocList>
        <li><strong>Roster page</strong> — click any student name in the accommodation roster</li>
        <li><strong>Grades → By Student tab</strong> — click any student name in the course-wide grades view</li>
      </DocList>
      <DocP>
        The URL follows the pattern <strong>/instructor/courses/[course-id]/roster/[student-id]</strong> and can be
        shared directly with another instructor or TA who has access to the same course.
      </DocP>

      <DocH2>Who Appears on the Roster?</DocH2>
      <DocP>
        The roster shows all students and observers with an active enrollment in the course. Every student appears,
        regardless of whether they have accommodation flags. Flags (Camera Off, Notes) are displayed when set — students
        without flags simply show without any badges. The progress and inline grading features are available for all
        students on the roster.
      </DocP>
    </>
  )
}
