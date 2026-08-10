import { DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'
import { DocAccordion } from '@/components/docs/DocAccordion'

export default function Assignments() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Assignments &amp; Grading</h1>
      <p className="text-sm text-muted-text mb-8">Create assignments, review submissions, and leave feedback.</p>

      <DocAccordion
        items={[
          {
            id: 'creating',
            title: 'Creating an Assignment',
            content: (
              <>
                <DocP>
                  The <strong>+ Create</strong> button in the course sidebar opens a shared modal for assignments,
                  resources, quizzes, and wikis:
                </DocP>
                <DocStep number={1}>Click <strong>+ Create</strong> and choose <strong>Assignment</strong> under &ldquo;What would you like to create?&rdquo;</DocStep>
                <DocStep number={2}>Choose a <strong>Section</strong> — <strong>Course Outline</strong>, <strong>Career Development</strong>, or <strong>Level Up Your Skills</strong>.</DocStep>
                <DocStep number={3}>Choose a <strong>Module</strong>, then a <strong>Day</strong> (required for assignments).</DocStep>
                <DocStep number={4}>Optionally pick <strong>Skills</strong> tags — preset tags or your own, added with <strong>+ Add</strong> — to label what the assignment covers. Visible to students.</DocStep>
                <DocStep number={5}>Click <strong>Create &amp; Edit →</strong> to open the assignment editor.</DocStep>
                <DocTip>
                  If the module you need doesn&apos;t exist yet, click <strong>+ New module</strong> inside the modal
                  to add one without leaving the flow — or type a title directly into the Module field when the
                  course has no modules yet.
                </DocTip>
                <DocNote>
                  Choosing <strong>Level Up Your Skills</strong> as the section marks the assignment as bonus
                  automatically (see Bonus Assignments &amp; Level Up below).
                </DocNote>
              </>
            ),
          },
          {
            id: 'editor',
            title: 'Assignment Editor',
            content: (
              <>
                <DocP>
                  The assignment editor opens on a dedicated page. A row of toggle buttons near the top controls
                  status — click any to flip it:
                </DocP>
                <DocList>
                  <li>
                    <strong>Published / Draft</strong> — controls student visibility. If the assignment requires a
                    submission, this toggle reads <strong>Draft</strong> / <strong>Published</strong>; if you&apos;ve
                    turned off submissions, it relabels itself <strong>Add to Gradebook</strong> /{' '}
                    <strong>In Gradebook</strong> instead — same toggle, same field, just worded for the no-submission
                    case.
                  </li>
                  <li><strong>Submission required / No submission</strong> — on means students must upload a link, text, or file; off is for completion-only assignments you check off directly (see Mark Complete Without Submission below).</li>
                  <li><strong>Bonus? / Bonus (Level Up)</strong> — marks the assignment as optional enrichment work that appears in Level Up Your Skills instead of the main Assignments list.</li>
                  <li><strong>Move to trash</strong> — soft-deletes the assignment, sitting at the far right of the row.</li>
                </DocList>
                <DocP>Below the toggle row:</DocP>
                <DocList>
                  <li><strong>Title</strong> — the assignment name students see</li>
                  <li><strong>Skills</strong> — the same preset-or-custom tag picker from the Create modal; shown to students as teal pills</li>
                  <li><strong>Due Date</strong> — a date picker; due time is fixed at <strong>11:59pm in the student&apos;s own timezone</strong></li>
                  <li><strong>Answer Key URL</strong> — a private link only instructors see; you can also add or edit it later directly from the submissions list or an individual grading page</li>
                  <li><strong>Instructions</strong> — rich-text field; formatting, code blocks, links, and images</li>
                  <li><strong>How to Turn In</strong> — rich-text instructions for what and where to submit</li>
                  <li><strong>Grading Checklist</strong> — see below</li>
                  <li><strong>Student Overrides</strong> — per-student due date changes or excused status, shown only when the course has enrolled students (see Due Date Overrides &amp; Extension Requests below)</li>
                </DocList>
                <DocP>
                  Click <strong>Save Changes</strong> to persist your edits. A <strong>View Submissions →</strong> link
                  next to the save button jumps straight to that assignment&apos;s submissions list.
                </DocP>
                <DocNote>
                  <strong>Move to trash</strong> immediately hides the assignment from students. Recover it from the
                  course <strong>Trash</strong> page at the bottom of the sidebar — see{' '}
                  <strong>Course Editor → Deleting Content</strong> for the full trash workflow.
                </DocNote>
              </>
            ),
          },
          {
            id: 'checklist',
            title: 'Grading Checklist & Templates',
            content: (
              <>
                <DocP>
                  The checklist is criteria students check off themselves before submitting, and that you check off
                  independently while grading — it keeps expectations explicit on both sides.
                </DocP>
                <DocH3>Adding Items</DocH3>
                <DocStep number={1}>Type item text (and an optional description) into the <strong>Add Item</strong> box at the bottom of the checklist.</DocStep>
                <DocStep number={2}>Click <strong>+ Add</strong>, or press Enter in the text field.</DocStep>
                <DocTip>
                  Paste multiple lines into the item text field to bulk-add several items at once — each line becomes
                  its own checklist item.
                </DocTip>
                <DocP>
                  Toggle <strong>Bonus?</strong> before adding an item to mark it not required — bonus items show an
                  amber <strong>Bonus</strong> badge and can be individually promoted back to required (or vice
                  versa) later with the <strong>Required?</strong> / <strong>Bonus?</strong> button that appears when
                  you hover an item. Drag the <strong>⠿</strong> handle on the left of any item to reorder the list.
                </DocP>
                <DocH3>Templates</DocH3>
                <DocP>
                  Use <strong>Load template…</strong> to replace the checklist with a saved one — the dropdown lists{' '}
                  <strong>Built-in</strong> templates (e.g. Frontend — CodePen, Weekly Check-In, Clean &amp; Comment
                  Your Code) and any <strong>Custom</strong> templates your team has saved. If the assignment already
                  has checklist items, loading a template asks you to confirm before replacing them.
                </DocP>
                <DocList>
                  <li>Click <strong>Save as template…</strong> to save the current checklist for reuse on other assignments.</li>
                  <li>Click <strong>Manage…</strong> to edit or delete custom templates — editing lets you save changes to <strong>all instances</strong> of the template, apply the edit to just this assignment, or save it as a brand-new template.</li>
                  <li>Click <strong>Clear</strong> to remove all items from the current assignment&apos;s checklist.</li>
                </DocList>
                <DocNote>
                  Custom templates are shared across the whole site, not scoped to one course — any instructor or
                  admin can load, edit, or delete one.
                </DocNote>
              </>
            ),
          },
          {
            id: 'overrides',
            title: 'Due Date Overrides & Extension Requests',
            content: (
              <>
                <DocP>
                  The <strong>Student Overrides</strong> section at the bottom of the assignment editor gives
                  individual students a different due date or excuses them entirely.
                </DocP>
                <DocH3>Adding a Custom Due Date</DocH3>
                <DocStep number={1}>Click <strong>+ Add override</strong> to expand the form.</DocStep>
                <DocStep number={2}>Select a student from the dropdown — only enrolled students appear, and students who already have an override are filtered out.</DocStep>
                <DocStep number={3}>Enter a date in the date field — a <strong>Save due date</strong> button appears once a date is set.</DocStep>
                <DocStep number={4}>Click <strong>Save due date</strong> — the student appears in the overrides list immediately with their custom date.</DocStep>
                <DocH3>Excusing a Student</DocH3>
                <DocStep number={1}>Click <strong>+ Add override</strong> to expand the form.</DocStep>
                <DocStep number={2}>Select the student from the dropdown.</DocStep>
                <DocStep number={3}>Click <strong>+ Excuse</strong> — the student is saved immediately with Excused status. No date entry needed.</DocStep>
                <DocList>
                  <li>Click <strong>Remove</strong> next to any override to delete it and restore the default due date</li>
                  <li>An excused override shows the student an amber <strong>Excused</strong> badge and suppresses any Late indicator</li>
                </DocList>
                <DocNote>
                  Excused assignments still appear for the student — they are not hidden. The Excused badge replaces
                  the Late indicator so students know they&apos;re covered.
                </DocNote>
                <DocH3>Extension Requests</DocH3>
                <DocP>
                  Students can request an extension on an assignment from their own view. Requests land on{' '}
                  <strong>Extension Requests</strong> in the sidebar (under the Grades section), with a badge showing
                  how many are pending review.
                </DocP>
                <DocList>
                  <li>Each request shows the student&apos;s reason, their plan for finishing, the requested due date, and any additional notes.</li>
                  <li>Click <strong>Approve</strong> or <strong>Deny</strong>; an optional comment is sent back to the student either way.</li>
                </DocList>
                <DocNote>
                  Approving a request automatically creates a due-date override for that student at the requested
                  date — you&apos;ll see it in this assignment&apos;s Student Overrides list too.
                </DocNote>
                <DocTip>
                  Use overrides (and extension approvals) for accommodations, extensions, or attendance exceptions.
                  Each override is student-specific and never affects anyone else in the course.
                </DocTip>
              </>
            ),
          },
          {
            id: 'bonus',
            title: 'Bonus Assignments & Level Up',
            content: (
              <>
                <DocP>
                  Bonus assignments are optional enrichment work that appear in{' '}
                  <strong>Level Up Your Skills</strong> rather than the main Assignments list.
                </DocP>
                <DocList>
                  <li>Mark an assignment as bonus with the <strong>Bonus?</strong> toggle in the assignment editor, or by choosing <strong>Level Up Your Skills</strong> as the section when creating it.</li>
                  <li>Bonus assignments don&apos;t appear in the Assignments list or Grades unless a student has completed them.</li>
                  <li>Manage them from <strong>Level Up Your Skills</strong> in the sidebar (under the Course section) — each one shows a <strong>Published</strong> / <strong>Draft</strong> toggle you can click directly in the list, its skill tags, and which module it came from.</li>
                  <li>Students see published bonus assignments in their own Level Up Your Skills page with skill tags displayed.</li>
                </DocList>
              </>
            ),
          },
          {
            id: 'grades-overview',
            title: 'Grades Overview',
            content: (
              <>
                <DocP>
                  <strong>Grades</strong> in the sidebar opens the course-wide grades view. A yellow number badge on
                  that link shows the total ungraded submissions across all students, visible from any page in the
                  course.
                </DocP>
                <DocP>The grades view has two tabs:</DocP>
                <DocList>
                  <li><strong>By Assignment</strong> — assignments grouped by module/week, each showing turned-in count, an ungraded badge, and complete/incomplete breakdown. Click a week header to collapse or expand it, or use <strong>Expand all / Collapse all</strong>. Click <strong>Grade →</strong> on any assignment to open its submissions list.</li>
                  <li><strong>By Student</strong> — each student with clickable counts for <strong>missing</strong>, <strong>ungraded</strong>, <strong>needs revision</strong>, and <strong>complete</strong> assignments. Clicking a count expands the matching list inline, with a <strong>Grade →</strong> / <strong>View →</strong> link per assignment (or <strong>View class →</strong> for missing work). Click a student&apos;s name to open their full detail view.</li>
                </DocList>
                <DocP>
                  Use the <strong>search bar</strong> at the top to filter by assignment title — results update as you
                  type and apply to both tabs.
                </DocP>
                <DocTip>
                  When there&apos;s ungraded work, an <strong>N need grading</strong> button appears at the top right
                  to open the Speed Grader.
                </DocTip>
              </>
            ),
          },
          {
            id: 'speed-grader',
            title: 'Speed Grader',
            content: (
              <>
                <DocP>
                  Speed Grader walks you through every ungraded submission in the course in one flow. Open it from
                  the <strong>N need grading</strong> button on the Grades page (it only appears when something needs
                  grading).
                </DocP>
                <DocList>
                  <li>Students are shown one at a time with their pending assignments listed.</li>
                  <li>Click <strong>✓ Complete</strong> or <strong>✗ Revision</strong> to grade inline — the item disappears from that student&apos;s queue immediately.</li>
                  <li>Click <strong>View</strong> to open the full submission when you need to read the work or leave a comment first.</li>
                  <li>Navigate between students with the <strong>← Prev</strong> / <strong>Next →</strong> links or the dot indicators at the bottom.</li>
                </DocList>
                <DocTip>
                  Keyboard shortcuts: <strong>C</strong> = Complete, <strong>R</strong> = Revision,{' '}
                  <strong>← →</strong> = prev/next student, <strong>Esc</strong> = close.
                </DocTip>
              </>
            ),
          },
          {
            id: 'individual-grading',
            title: 'Grading an Individual Submission',
            content: (
              <>
                <DocP>
                  From Grades, click <strong>Grade →</strong> on an assignment to open its submissions list. The list
                  opens on the <strong>Needs Grading</strong> filter automatically when ungraded submissions exist
                  (otherwise it opens on <strong>All</strong>). A <strong>Grade all ungraded →</strong> button jumps
                  straight to the first ungraded student.
                </DocP>
                <DocP>On the individual grading page:</DocP>
                <DocList>
                  <li>Click <strong>Complete</strong> or <strong>Incomplete</strong> to grade. Clicking the same button again removes that grade.</li>
                  <li>A <strong>Next →</strong> button appears next to the grade buttons right after you grade — click it to move to the next ungraded student. Grading no longer auto-advances on its own.</li>
                  <li>Use the <strong>← / →</strong> student links in the nav strip to browse everyone who&apos;s submitted (or, in a Speed Grader / Launch Grader session, everyone still ungraded).</li>
                  <li>The assignment instructions collapse into a reference panel; the answer key, checklist, comments, and submission history all live below the submission itself.</li>
                </DocList>
                <DocH3>Checklist Review</DocH3>
                <DocP>
                  The checklist shown here is yours to check off — it&apos;s a separate record from the student&apos;s
                  self-check. Any item the student already checked off shows a small{' '}
                  <strong>✓ student</strong> tag next to it, so you can see their self-assessment alongside your own
                  judgment.
                </DocP>
                <DocH3>Comments</DocH3>
                <DocP>
                  A threaded comment section lives below the checklist. Both you and the student can post — whoever
                  goes first starts the thread, and the other can reply. Comments are visible to the student
                  immediately after you save.
                </DocP>
                <DocList>
                  <li>Hover a comment to reveal <strong>Edit</strong> — authors can edit their own comments any time.</li>
                  <li>Hover a comment to reveal <strong>Delete</strong> — you can delete any comment (yours or the student&apos;s); an inline confirmation prevents accidental deletes. Students can only delete their own.</li>
                </DocList>
                <DocNote>
                  If the student left a note when they submitted, it appears as <strong>Note from student</strong> at
                  the bottom of the submission card — separate from the comment thread below it.
                </DocNote>
                <DocH3>Mark Complete Without Submission</DocH3>
                <DocP>
                  For assignments with <strong>No submission</strong> turned on, mark a student complete directly from
                  the submissions list — no submission is ever required. A placeholder record is created behind the
                  scenes so grading works the same as any other assignment.
                </DocP>
                <DocH3>Submission History</DocH3>
                <DocP>
                  When a student resubmits, every prior version is preserved. The most recent submission appears in
                  the <strong>Submission</strong> card at the top; a <strong>Previous Submissions (N)</strong> card
                  below lists every earlier version in reverse order — &ldquo;1st submission&rdquo;, &ldquo;Submission
                  2&rdquo;, etc. — with its own timestamp and content. This card only appears once a student has
                  submitted more than once.
                </DocP>
                <DocH3>Grade History</DocH3>
                <DocP>
                  Once a submission has been graded at least once, a <strong>Grade History</strong> card lists every
                  grade with its timestamp — including the very first one, not just later changes. A badge appears
                  on the card only when at least one of those grades was <strong>Incomplete</strong>, showing how
                  many times.
                </DocP>
                <DocNote>
                  Submission history is recorded from when the history feature was introduced. Submissions made
                  before that point won&apos;t appear in Previous Submissions, even if the student has resubmitted
                  since.
                </DocNote>
              </>
            ),
          },
          {
            id: 'by-student-mode',
            title: 'By Student Mode',
            content: (
              <>
                <DocP>
                  <strong>By Student mode</strong> flips the grading page&apos;s navigation so you work through one
                  student&apos;s entire queue instead of one assignment&apos;s entire student list. It adds a second
                  nav strip above the usual one: the top strip steps between that student&apos;s{' '}
                  <em>assignments</em> (prev/next assignment title), and the one below it steps between{' '}
                  <em>students</em> who&apos;ve submitted this same assignment — so you can move in either direction
                  without leaving the flow.
                </DocP>
                <DocP>By Student mode is activated from two places:</DocP>
                <DocList>
                  <li><strong>Grades → By Student tab</strong> — click a student&apos;s name or any of their counts to open the grader in By Student mode for that student.</li>
                  <li><strong>Gradebook</strong> — hover any cell with a submission and click <strong>Open</strong>; the grader opens in a new tab, in By Student mode.</li>
                </DocList>
                <DocTip>
                  By Student mode is ideal for reviewing one student&apos;s overall progress in a single session.
                  Grade their whole queue, then close the tab or navigate back — the Gradebook or Grades page will
                  still be right where you left it.
                </DocTip>
              </>
            ),
          },
          {
            id: 'grading-groups',
            title: 'Grading Groups',
            content: (
              <>
                <DocP>
                  Grading Groups divide students among instructors and TAs so each grader is responsible for a
                  specific subset. Go to <strong>Grading Groups</strong> in the course sidebar (instructors only —
                  TAs don&apos;t see this page).
                </DocP>
                <DocH3>Assigning Students</DocH3>
                <DocList>
                  <li><strong>Auto-distribute evenly</strong> — splits all students as evenly as possible across every available grader with one click.</li>
                  <li><strong>Drag and drop</strong> — drag a student card from one grader&apos;s column to another, or to the Unassigned pile to remove their assignment.</li>
                </DocList>
                <DocTip>
                  Each grader card shows a yellow <strong>N ungraded</strong> badge so you can see who has the most
                  work waiting.
                </DocTip>
                <DocH3>Rotating Groups</DocH3>
                <DocList>
                  <li><strong>Swap Groups ⇄</strong> (2 graders) — swaps the two groups so each grader takes the other&apos;s students.</li>
                  <li><strong>Rotate Groups →</strong> (3+ graders) — shifts each grader to the next group in order (A→B→C→A).</li>
                </DocList>
                <DocNote>Unassigned students stay unassigned during a swap or rotate.</DocNote>
                <DocH3>Weekly Rotation</DocH3>
                <DocP>
                  By default, one set of groups applies to the whole course. Turn on <strong>Weekly Rotation</strong>{' '}
                  at the top of the page to create separate groups per module/week instead.
                </DocP>
                <DocStep number={1}>Set up your base groups first with <strong>Auto-distribute evenly</strong> — weekly rotation needs a starting point.</DocStep>
                <DocStep number={2}>Click <strong>Enable</strong> next to Weekly Rotation. Each module becomes its own collapsible section with its own Auto-distribute and Swap/Rotate controls.</DocStep>
                <DocStep number={3}>Expand a week and drag students between graders, or use that week&apos;s own Rotate/Auto-distribute buttons, independently of every other week.</DocStep>
                <DocNote>
                  Clicking <strong>Disable</strong> asks you to confirm — it deletes all week-specific assignments,
                  but your base (flat) groups are preserved underneath.
                </DocNote>
                <DocH3>Assignment Overrides</DocH3>
                <DocP>
                  Below the groups, <strong>Assignment Overrides</strong> let you pin a specific grader to one
                  assignment — that person grades it for every student regardless of group. Leave it as{' '}
                  <strong>Follow student group</strong> to use the normal group assignment.
                </DocP>
              </>
            ),
          },
          {
            id: 'launch-grader',
            title: 'Launch Grader',
            content: (
              <>
                <DocP>
                  <strong>Launch Grader →</strong> in the sidebar (with a badge showing your grading-group ungraded
                  count) opens a modal with four options:
                </DocP>
                <DocList>
                  <li><strong>By Student</strong> — jumps to the Grades page&apos;s By Student tab, to see each student with their assignment statuses.</li>
                  <li><strong>By Assignment</strong> — jumps to the Grades page&apos;s By Assignment tab, to see each assignment with submission counts and ungraded work.</li>
                  <li><strong>Grade All Ungraded</strong> — jumps straight into grading, moving through every assignment that has ungraded work; shows an &ldquo;N waiting&rdquo; count, and is disabled with &ldquo;No submissions need grading right now&rdquo; when there&apos;s nothing to grade.</li>
                  <li><strong>Grade for My Group</strong> — grades only the students assigned to you in Grading Groups, respecting any assignment overrides; disabled the same way when your group has nothing waiting.</li>
                </DocList>
                <DocTip>
                  Only <strong>Grade All Ungraded</strong> and <strong>Grade for My Group</strong> launch an actual
                  grading queue (with Next-student navigation); <strong>By Student</strong> and{' '}
                  <strong>By Assignment</strong> are shortcuts to the corresponding Grades page tab.
                </DocTip>
                <DocH3>Grading Priority</DocH3>
                <DocList>
                  <li><strong>Assignment override</strong> takes priority — if set, that grader handles the assignment for all students.</li>
                  <li><strong>Student group</strong> — if no override, the student&apos;s assigned grader handles it.</li>
                  <li><strong>Unassigned</strong> — appears in Grade All Ungraded but not in anyone&apos;s Grade for My Group queue.</li>
                </DocList>
              </>
            ),
          },
        ]}
      />
    </>
  )
}
