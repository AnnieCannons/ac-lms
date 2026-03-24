import { DocH2, DocH3, DocP, DocList, DocTip, DocNote } from '@/components/docs/DocComponents'

export default function Gradebook() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Gradebook</h1>
      <p className="text-sm text-muted-text mb-8">
        A spreadsheet view of every student&apos;s status on every published assignment — at a glance.
      </p>

      <DocH2>Opening the Gradebook</DocH2>
      <DocP>
        Click <strong>Gradebook</strong> in the course sidebar under the Grades section. The page loads a full-width
        spreadsheet with students as rows and published assignments as columns.
      </DocP>

      <DocH2>Reading the Grid</DocH2>
      <DocP>Each cell shows the current status of that student&apos;s work on that assignment:</DocP>
      <DocList>
        <li><strong>✓ green</strong> — graded Complete</li>
        <li><strong>✗ red</strong> — graded Needs Revision</li>
        <li><strong>● yellow</strong> — submitted but not yet graded</li>
        <li><strong>– amber</strong> — past due with no submission (late / missing)</li>
        <li><strong>empty with border</strong> — not yet due, no submission</li>
      </DocList>
      <DocTip>
        Hover over any filled cell to reveal an <strong>Open →</strong> link. Click it to open the grader for that
        student &amp; assignment in a new tab, in <em>By Student</em> mode — so you can navigate through all of that
        student&apos;s assignments without coming back to the gradebook.
      </DocTip>

      <DocH2>Filters</DocH2>
      <DocP>Three dropdowns at the top let you narrow the view:</DocP>
      <DocList>
        <li><strong>All Weeks</strong> — filter columns by one or more module weeks; select multiple to compare across weeks</li>
        <li><strong>All Students</strong> — filter rows to one or more specific students; type to search the list</li>
        <li><strong>All Assignments</strong> — filter columns to specific assignments by name; type to search</li>
      </DocList>
      <DocP>
        All three filters compose — you can combine week, student, and assignment filters at the same time. The
        count badge at the top updates to show how many rows and columns remain after filtering. Click the badge count
        or <strong>Clear</strong> inside the dropdown to reset a filter.
      </DocP>
      <DocNote>
        Only <strong>published</strong> assignments appear in the gradebook. Draft assignments are hidden until you
        publish them from the assignment editor.
      </DocNote>

      <DocH2>Column Headers</DocH2>
      <DocP>
        Each column header shows the week label and assignment title, truncated to fit the column width. Hover over a
        header to see the full title and due date in a tooltip.
      </DocP>
      <DocP>
        To make a column wider, hover the right edge of the header until the cursor changes to a resize arrow, then
        drag to your preferred width. Each column can be resized independently; minimun width is 60px.
      </DocP>

      <DocH2>Student Names</DocH2>
      <DocP>
        Each student&apos;s name in the left column is a link that opens their <strong>Student Detail</strong> page in a
        new tab, showing their full progress breakdown and inline grading controls.
      </DocP>

      <DocH2>Opening the Grader from the Gradebook</DocH2>
      <DocP>
        Hover any non-empty cell and click <strong>Open →</strong>. The grader opens in a new tab in
        <strong> By Student mode</strong>, meaning the navigation strip at the top of the grader lets you step through
        all of that student&apos;s assignments — not just submissions for the one assignment you clicked.
      </DocP>
      <DocTip>
        When you&apos;re done grading one student&apos;s queue, close the grader tab to return to the gradebook exactly
        where you left off.
      </DocTip>
    </>
  )
}
