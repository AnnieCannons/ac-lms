import { DocH3, DocP, DocList, DocOL, DocTip, DocNote, DocStep, DocCode } from '@/components/docs/DocComponents'
import { DocAccordion } from '@/components/docs/DocAccordion'

export default function Gradebook() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Gradebook</h1>
      <p className="text-sm text-muted-text mb-8">
        A spreadsheet view of every student&apos;s status on every published assignment — at a glance.
      </p>

      <DocAccordion
        items={[
          {
            id: 'opening',
            title: 'Opening the Gradebook',
            content: (
              <>
                <DocStep number={1}>Open the course from Courses.</DocStep>
                <DocStep number={2}>
                  In the sidebar, under the <strong>Grades</strong> section header, click <strong>Gradebook</strong>.
                </DocStep>
                <DocP>
                  The page loads a full-width grid with students as rows and published assignments as columns.
                </DocP>
                <DocNote>
                  Only <strong>published</strong> assignments appear in the Gradebook. A draft assignment stays hidden
                  until you publish it from the assignment editor.
                </DocNote>
              </>
            ),
          },
          {
            id: 'reading-grid',
            title: 'Reading the Grid',
            content: (
              <>
                <DocP>Each cell shows the current status of that student&apos;s work on that assignment:</DocP>
                <DocList>
                  <li><strong>✓ green</strong> — graded Complete</li>
                  <li><strong>✗ red</strong> — graded Needs Revision</li>
                  <li><strong>● yellow</strong> — submitted, not yet graded</li>
                  <li><strong>– amber</strong> — missing / past due, no submission</li>
                  <li><strong>empty, bordered</strong> — not yet due, no submission</li>
                </DocList>
                <DocTip>
                  Hover any cell that has a submission (✓, ✗, or ●) to reveal an <strong>Open</strong> link. Click it
                  to open the grader for that student and assignment in a new tab — from there you get prev/next
                  controls both for that student&apos;s other assignments and for other students on this same
                  assignment, so you can keep grading without coming back to the Gradebook in between. Close the
                  grader tab when you&apos;re done to land back on the Gradebook exactly where you left it.
                </DocTip>

                <DocH3>No-Submission Assignments</DocH3>
                <DocP>
                  Assignments set to <strong>No submission</strong> in the assignment editor use a circular toggle
                  instead of the status icons above — a student either has been marked complete or hasn&apos;t.
                </DocP>
                <DocStep number={1}>Find the student&apos;s cell for that assignment — it shows an empty circle (○).</DocStep>
                <DocStep number={2}>Click the circle to mark the student complete; it turns into a green checkmark (✓). Click it again to unmark.</DocStep>
                <DocP>
                  These cells never show as missing or late — students aren&apos;t expected to submit anything for a
                  no-submission assignment.
                </DocP>
                <DocNote>
                  No-submission assignments reuse the same <strong>Publish</strong> toggle in the assignment editor,
                  just relabeled: it reads <strong>Add to Gradebook</strong> / <strong>In Gradebook</strong> instead
                  of <strong>Draft</strong> / <strong>Published</strong>. Toggling it is what controls whether the
                  assignment shows up as a column here.
                </DocNote>
              </>
            ),
          },
          {
            id: 'filters',
            title: 'Filtering the Grid',
            content: (
              <>
                <DocP>
                  Three dropdowns in the toolbar let you narrow the grid, and all three combine. A count next to
                  them (e.g. &ldquo;12 assignments · 24 students&rdquo;) reflects your Week and Student selections
                  plus any assignments you&apos;ve picked by name.
                </DocP>
                <DocNote>
                  That count doesn&apos;t update when you use a status quick-filter (below) — the grid itself still
                  narrows to matching rows and columns, but the count keeps showing the Week/Student/named-assignment
                  total.
                </DocNote>
                <DocList>
                  <li>
                    <strong>All Weeks</strong> — select one or more module weeks. Your selection is remembered the
                    next time you open this course&apos;s Gradebook.
                  </li>
                  <li>
                    <strong>All Students</strong> — select one or more students, or type to search the list. If
                    you&apos;re part of a grading group for this course, a <strong>My Grading Group</strong> option
                    appears above the list and filters the grid to just your assigned students. If the course splits
                    grading groups by week, selecting a single week narrows this further to your group for that
                    specific week.
                  </li>
                  <li>
                    <strong>All Assignments</strong> — opens a combined <strong>Filter by Assignment</strong> panel
                    (below).
                  </li>
                </DocList>
                <DocNote>
                  While <strong>My Grading Group</strong> is active, assignment columns are also narrowed: any
                  assignment that another instructor is specifically assigned to grade drops out, leaving only
                  assignments with no assigned grader or ones assigned to you.
                </DocNote>

                <DocH3>Filter by Assignment</DocH3>
                <DocP>The assignment dropdown offers two ways to narrow the grid:</DocP>
                <DocOL>
                  <li>
                    Pick one or more status quick-filters — <strong>Complete</strong>, <strong>Needs Revision</strong>,{' '}
                    <strong>Ungraded</strong>, <strong>Late / Missing</strong>, or <strong>Not Yet Due</strong> — to
                    narrow the grid down to the students and assignments that have at least one cell in one of those
                    statuses. This is a row/column-level filter, not a per-cell one — a student or assignment that
                    qualifies still shows all of their other cells too.
                  </li>
                  <li>
                    Or type into <strong>Search for a specific assignment…</strong> and check off one or more
                    assignments by name.
                  </li>
                </DocOL>
                <DocP>
                  The two modes don&apos;t combine with each other — picking a status clears any assignment-name
                  selection, and picking an assignment clears any status selection. Each dropdown has its own{' '}
                  <strong>Clear</strong> (or <strong>Clear all</strong>) link to reset just that filter.
                </DocP>
              </>
            ),
          },
          {
            id: 'columns',
            title: 'Column Headers & Layout',
            content: (
              <>
                <DocP>
                  Each column header shows the week (e.g. <DocCode>W3</DocCode>) above the assignment title, which
                  wraps to fit the column&apos;s current width rather than being cut off. Hover the title to see the
                  full title, due date, and a &ldquo;Click to edit&rdquo; hint in a tooltip.
                </DocP>
                <DocStep number={1}>Click an assignment&apos;s title in its column header.</DocStep>
                <DocStep number={2}>It opens that assignment in the editor, in a new tab.</DocStep>

                <DocH3>Resizing Columns</DocH3>
                <DocStep number={1}>Hover the right edge of a column header until the cursor becomes a resize arrow.</DocStep>
                <DocStep number={2}>Drag to the width you want. Each column resizes independently; minimum width is 60px.</DocStep>

                <DocH3>Swapping Rows and Columns</DocH3>
                <DocP>
                  By default, students are rows and assignments are columns. Click <strong>Student ⇄</strong> in the
                  top-left corner of the grid to flip the layout so assignments become rows and students become
                  columns. Click <strong>Assignment ⇄</strong> in the same corner to flip back.
                </DocP>
              </>
            ),
          },
          {
            id: 'student-names',
            title: 'Student Names',
            content: (
              <>
                <DocP>
                  Each student&apos;s name in the left-most column is a link. Click it to open their{' '}
                  <strong>Student Detail</strong> page in a new tab, showing their full progress breakdown.
                </DocP>
              </>
            ),
          },
        ]}
      />
    </>
  )
}
