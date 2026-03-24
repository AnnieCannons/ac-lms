import { DocH2, DocH3, DocP, DocList, DocOL, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'

export default function Assignments() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Assignments &amp; Grading</h1>
      <p className="text-sm text-muted-text mb-8">Create assignments, review submissions, and leave feedback.</p>

      <DocH2>Creating an Assignment</DocH2>
      <DocP>Use the <strong>+ Create</strong> button in the course sidebar:</DocP>
      <DocStep number={1}>Click <strong>+ Create</strong> and select <strong>Assignment</strong>.</DocStep>
      <DocStep number={2}>Choose a <strong>Section</strong> (Course Outline, Career Development, or Level Up Your Skills), a <strong>Module</strong>, and optionally a <strong>Day</strong>.</DocStep>
      <DocStep number={3}>Optionally add <strong>Skill Tags</strong> to label what skills the assignment covers — visible to students.</DocStep>
      <DocStep number={4}>Click <strong>Create &amp; Edit →</strong> to open the assignment editor.</DocStep>
      <DocTip>
        If the module you need doesn&apos;t exist yet, click <strong>+ New module</strong> in the Create modal to add one
        without leaving the flow.
      </DocTip>

      <DocH2>Assignment Editor</DocH2>
      <DocP>
        The assignment editor opens on a dedicated page. At the top is a row of toggle buttons — click any to activate
        or deactivate it:
      </DocP>
      <DocList>
        <li><strong>Published / Draft</strong> — controls student visibility; toggle to Published when the assignment is ready for students</li>
        <li><strong>Submission Required / No submission</strong> — on means students must upload a link, text, or file; off is for completion-only assignments your instructor checks directly</li>
        <li><strong>Bonus?</strong> — marks the assignment as optional bonus work (see Level Up below)</li>
        <li><strong>Move to trash</strong> — soft-deletes the assignment (see Deleting an Assignment below)</li>
      </DocList>
      <DocP>Below the toggle row, the editor has these fields:</DocP>
      <DocList>
        <li><strong>Title</strong> — the assignment name students see</li>
        <li><strong>Skill Tags</strong> — pick from preset tags or add custom ones; shown to students as teal pills</li>
        <li><strong>Due Date</strong> — optional; shown to students on the assignment page and in their Assignments list</li>
        <li><strong>Answer Key URL</strong> — a private link only visible to instructors on the grading page</li>
        <li><strong>Instructions</strong> — rich-text field; supports formatting, code blocks, links, and images</li>
        <li><strong>How to Turn In</strong> — instructions for students on what to submit and where</li>
        <li><strong>Grading Checklist</strong> — criteria students check off before submitting; helps self-assessment and informs your grading</li>
        <li><strong>Student Overrides</strong> — per-student due date extensions or excused status (see below)</li>
      </DocList>

      <DocTip>
        Use the checklist to communicate rubric expectations clearly. Students see the same checklist and check items
        off before submitting — this reduces ambiguity and helps them self-assess before you grade. You can paste
        multiple lines at once into the item text field to bulk-add checklist items.
      </DocTip>

      <DocH2>Deleting an Assignment</DocH2>
      <DocP>
        Use the <strong>Move to trash</strong> button in the button row at the top of the assignment editor to
        soft-delete an assignment. Trashed assignments are immediately hidden from students but can be recovered from
        the course <strong>Trash</strong> page (bottom of the sidebar). See{' '}
        <strong>Course Editor → Deleting Content</strong> for details on the trash workflow.
      </DocP>

      <DocH2>Student Due Date Overrides</DocH2>
      <DocP>
        The <strong>Student Overrides</strong> section at the bottom of the assignment editor lets you give individual
        students a different due date or excuse them from the assignment entirely.
      </DocP>

      <DocH3>Adding a Custom Due Date</DocH3>
      <DocStep number={1}>Click <strong>+ Add override</strong> to expand the form.</DocStep>
      <DocStep number={2}>Select a student from the dropdown — only enrolled students appear, and students who already have an override are filtered out.</DocStep>
      <DocStep number={3}>Enter a date in the date field.</DocStep>
      <DocStep number={4}>Click <strong>Save due date</strong> — the student appears in the overrides list immediately with their custom date.</DocStep>

      <DocH3>Excusing a Student</DocH3>
      <DocStep number={1}>Click <strong>+ Add override</strong> to expand the form.</DocStep>
      <DocStep number={2}>Select the student from the dropdown.</DocStep>
      <DocStep number={3}>Click <strong>+ Excuse</strong> — the student is saved immediately with Excused status. No date entry is needed.</DocStep>

      <DocList>
        <li>Click <strong>Remove</strong> next to any override to delete it and restore the default due date</li>
        <li>An excused override shows the student an amber <strong>Excused</strong> badge and suppresses any Late indicator</li>
      </DocList>
      <DocNote>
        Excused assignments still appear for the student — they are not hidden. The Excused badge replaces the Late
        indicator so students know they&apos;re covered.
      </DocNote>
      <DocTip>
        Use overrides for students with accommodations, extensions, or attendance exceptions. Each override is
        student-specific and does not affect anyone else in the course.
      </DocTip>

      <DocH2>Bonus Assignments &amp; Level Up</DocH2>
      <DocP>
        Bonus assignments are optional enrichment work that appear in <strong>Level Up Your Skills</strong> rather than
        in the main Assignments list.
      </DocP>
      <DocList>
        <li>Mark an assignment as bonus using the <strong>Bonus</strong> toggle in the assignment editor, or by choosing <strong>Level Up Your Skills</strong> as the section when creating.</li>
        <li>Bonus assignments do not appear in the Assignments list or Grades unless a student has completed them.</li>
        <li>Publish bonus assignments from the <strong>Level Up</strong> page in the sidebar.</li>
        <li>Students see published bonus assignments in their Level Up page with skill tags displayed.</li>
      </DocList>

      <DocH2>Grades Overview</DocH2>
      <DocP>
        The <strong>Grades</strong> link in the sidebar opens the course-wide grades view. A yellow number badge
        on the sidebar link shows how many submissions currently need grading — visible from any page in the course.
      </DocP>
      <DocP>The grades view has two tabs:</DocP>
      <DocList>
        <li><strong>By Assignment</strong> — all assignments grouped by module/week, each showing the turned-in count, an ungraded badge, and complete/incomplete breakdown. Click any week header to collapse or expand that section. Use <strong>Expand all / Collapse all</strong> to manage all sections at once.</li>
        <li><strong>By Student</strong> — each student with their missing, needs-grading, incomplete, and complete counts; click any count to expand the assignment list inline; click a student&apos;s name to open their full detail view</li>
      </DocList>
      <DocP>
        Use the <strong>search bar</strong> at the top to filter by assignment title — results update as you type and work across both tabs.
      </DocP>
      <DocTip>
        Click the <strong>N need grading</strong> button (top right) to open the <strong>Speed Grader</strong> — a
        focused modal that walks you through every ungraded student without leaving the page.
      </DocTip>

      <DocH2>Speed Grader</DocH2>
      <DocP>
        The Speed Grader lets you grade all ungraded submissions across the entire course in one flow. Open it from the
        <strong> N need grading</strong> button on the Grades page.
      </DocP>
      <DocList>
        <li>Students are shown one at a time with their pending assignments listed.</li>
        <li>Click <strong>✓ Complete</strong> or <strong>✗ Revision</strong> to grade inline — the item disappears from the queue immediately.</li>
        <li>Click <strong>View</strong> to open the full submission when you need to read the work or leave a comment first.</li>
        <li>Navigate between students with the <strong>← →</strong> arrows or the dot indicators at the bottom.</li>
      </DocList>
      <DocTip>
        Keyboard shortcuts: <strong>C</strong> = Complete, <strong>R</strong> = Revision,
        <strong> ← →</strong> = prev/next student, <strong>Esc</strong> = close.
      </DocTip>

      <DocH2>Grading an Individual Submission</DocH2>
      <DocP>
        From Grades, click <strong>Grade →</strong> on an assignment to open its submissions list. The list
        opens on <strong>Needs Grading</strong> automatically when ungraded submissions exist. A
        <strong> Grade all ungraded →</strong> button jumps directly to the first ungraded student.
      </DocP>
      <DocP>On the individual grading page:</DocP>
      <DocList>
        <li>Click <strong>Complete</strong> or <strong>Incomplete</strong> — the page automatically advances to the next ungraded student after you grade</li>
        <li>The nav strip shows <strong>N need grading</strong> so you always know your progress for this assignment</li>
        <li>Use the <strong>← / →</strong> links in the nav strip to browse all students (not just ungraded)</li>
        <li>The answer key, checklist review, comments, and submission history are all on the same page</li>
      </DocList>
      <DocNote>
        Auto-advance only happens when grading for the <em>first time</em> (no previous grade → complete/incomplete).
        Changing or removing an existing grade stays on the same page.
      </DocNote>

      <DocH3>By Student Mode</DocH3>
      <DocP>
        <strong>By Student mode</strong> flips the navigation so you work through one student&apos;s
        entire queue instead of one assignment&apos;s entire student list. In this mode the nav strip at
        the top shows assignment titles on the left and right rather than student names — use <strong>← →</strong> to
        step through all of that student&apos;s ungraded assignments without returning to the grades list.
      </DocP>
      <DocP>By Student mode is activated from two places:</DocP>
      <DocList>
        <li><strong>Grades → By Student tab</strong> — click the student&apos;s name or any count to open the grader in By Student mode for that student</li>
        <li><strong>Gradebook</strong> — hover any cell and click <strong>Open →</strong>; the grader opens in By Student mode so you can navigate all of that student&apos;s assignments from one entry point</li>
      </DocList>
      <DocTip>
        By Student mode is ideal for reviewing one student&apos;s overall progress in a single session. Grade
        their whole queue, then close or navigate back — the Gradebook will still be right where you left off.
      </DocTip>

      <DocH3>Instructor Checklist Review</DocH3>
      <DocP>
        On the grading page you see the same checklist the student used. Review which items they checked off and use that
        alongside their submission to inform your grade.
      </DocP>

      <DocH3>Comments</DocH3>
      <DocP>
        A threaded comment section lives below the submission form. Both you and the student can post — whoever goes
        first starts the thread, and the other can reply. Comments are visible to the student immediately after you save.
      </DocP>
      <DocList>
        <li><strong>Edit</strong> your own comments at any time by hovering over a comment to reveal the Edit option.</li>
        <li><strong>Delete</strong> any comment — your own or the student&apos;s — by hovering and clicking Delete. An inline confirmation prevents accidental deletes.</li>
        <li>Students can also edit or delete their own comments, so threads stay clean without your involvement.</li>
      </DocList>
      <DocTip>
        For students who may be sensitive to feedback, use comments to frame revision requests with clarity and
        encouragement — a specific, constructive comment alongside a Needs Revision grade makes resubmitting feel approachable.
      </DocTip>

      <DocH2>Mark Complete Without Submission</DocH2>
      <DocP>
        For assignments without a submission requirement, mark a student&apos;s assignment as complete directly from the
        submissions list — no student submission required. Useful for attendance-based or in-class completion assignments.
      </DocP>

      <DocH2>Submission History</DocH2>
      <DocP>
        When a student resubmits, all prior submissions are preserved. On the grading page the most recent submission
        appears in the <strong>Submission</strong> card at the top. Below it, a separate <strong>Previous
        Submissions</strong> card lists every earlier version in reverse chronological order — labeled
        &ldquo;1st submission&rdquo;, &ldquo;2nd submission&rdquo;, etc. — each with its timestamp and content.
      </DocP>
      <DocP>
        The Previous Submissions card only appears when the student has submitted more than once. Use it to see how
        their work evolved across revisions, or to compare the resubmission against their original attempt.
      </DocP>
      <DocNote>
        Submission history is recorded from when the history feature was introduced. Submissions made before that
        point will not appear in the Previous Submissions card even if a student has resubmitted since.
      </DocNote>

      <DocH2>Grading Groups</DocH2>
      <DocP>
        Grading Groups let you divide students among instructors and TAs so each grader is responsible for a specific
        subset of students. Go to <strong>Grading Groups</strong> in the course sidebar.
      </DocP>

      <DocH3>Assigning Students</DocH3>
      <DocList>
        <li><strong>Auto-distribute evenly</strong> — splits all students as evenly as possible across all available graders with one click</li>
        <li><strong>Drag and drop</strong> — drag a student card from one grader&apos;s column to another, or to the Unassigned pile to remove their assignment</li>
      </DocList>
      <DocTip>
        Each grader card shows a yellow <strong>N ungraded</strong> badge so you can see who has the most work waiting.
      </DocTip>

      <DocH3>Rotating Groups</DocH3>
      <DocList>
        <li><strong>Swap Groups ⇄</strong> (2 graders) — swaps the two groups so each grader takes the other&apos;s students</li>
        <li><strong>Rotate Groups →</strong> (3+ graders) — shifts each grader to the next group in order (A→B→C→A)</li>
      </DocList>
      <DocNote>
        Unassigned students stay unassigned during a swap or rotate.
      </DocNote>

      <DocH3>Assignment Overrides</DocH3>
      <DocP>
        Below the student columns, <strong>Assignment Overrides</strong> let you pin a specific grader to one assignment.
        That person grades it for all students regardless of group. Leave it as <em>Follow student group</em> to use
        the normal group assignment.
      </DocP>

      <DocH2>Launch Grader</DocH2>
      <DocP>
        The <strong>Launch Grader</strong> button in the sidebar (with a badge showing ungraded count) opens a modal
        with four speed-grading modes:
      </DocP>
      <DocList>
        <li><strong>By Student</strong> — work through all ungraded students one at a time across all assignments</li>
        <li><strong>By Assignment</strong> — work through ungraded submissions one assignment at a time</li>
        <li><strong>All Ungraded</strong> — grade everything in sequence</li>
        <li><strong>Grade for My Group</strong> — grade only the students assigned to you in Grading Groups; respects assignment overrides</li>
      </DocList>
      <DocTip>
        TAs see a <strong>Grade for My Group</strong> count badge showing only their own assigned students&apos; ungraded
        submissions — so they always know how much work is in their queue.
      </DocTip>

      <DocH3>Grading Priority</DocH3>
      <DocList>
        <li><strong>Assignment override</strong> takes priority — if set, that grader handles the assignment for all students</li>
        <li><strong>Student group</strong> — if no override, the student&apos;s assigned grader handles it</li>
        <li><strong>Unassigned</strong> — appears in All Ungraded but not in anyone&apos;s Grade for My Group queue</li>
      </DocList>
    </>
  )
}
