import { DocH2, DocH3, DocP, DocList, DocOL, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'

export default function Assignments() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Assignments & Grading</h1>
      <p className="text-sm text-muted-text mb-8">Create assignments, review submissions, and leave feedback.</p>

      <DocH2>Creating an Assignment</DocH2>
      <DocP>Use the <strong>+ Create</strong> button in the course sidebar:</DocP>
      <DocStep number={1}>Click <strong>+ Create</strong> and select <strong>Assignment</strong>.</DocStep>
      <DocStep number={2}>Choose a <strong>Section</strong> (Coding Class, Career Development, or Level Up Your Skills), a <strong>Module</strong>, and optionally a <strong>Day</strong>.</DocStep>
      <DocStep number={3}>Optionally add <strong>Skill Tags</strong> to label what skills the assignment covers — visible to students.</DocStep>
      <DocStep number={4}>Click <strong>Create &amp; Edit →</strong> to open the assignment editor.</DocStep>
      <DocTip>
        If the module you need doesn&apos;t exist yet, click <strong>+ New module</strong> in the Create modal to add one
        without leaving the flow.
      </DocTip>

      <DocH2>Assignment Editor</DocH2>
      <DocP>The assignment editor has several sections:</DocP>
      <DocList>
        <li><strong>Instructions</strong> — rich-text field; supports formatting, code blocks, links, and images</li>
        <li><strong>Checklist Items</strong> — add self-assessment criteria that students check off before submitting</li>
        <li><strong>Submission Required</strong> — toggle on if students must upload a link/text/file; toggle off for completion-only assignments</li>
        <li><strong>Due Date</strong> — optional; shown to students on the assignment page and list</li>
        <li><strong>Published</strong> — controls student visibility</li>
        <li><strong>Bonus</strong> — marks the assignment as a bonus (see Level Up below)</li>
        <li><strong>Skill Tags</strong> — pick from preset tags or add custom ones; shown to students as teal pills</li>
      </DocList>

      <DocTip>
        Use the checklist to communicate rubric expectations. Students see the same checklist and check items off before
        submitting, which helps them self-review before you grade.
      </DocTip>

      <DocH2>Bonus Assignments &amp; Level Up</DocH2>
      <DocP>
        Bonus assignments are optional enrichment work that appear in <strong>Level Up Your Skills</strong> rather than
        in the main Assignments list.
      </DocP>
      <DocList>
        <li>Mark an assignment as bonus using the <strong>Bonus</strong> toggle in the assignment editor, or by choosing <strong>Level Up Your Skills</strong> as the section when creating.</li>
        <li>Bonus assignments do not appear in the Assignments list or Grades unless a student has completed them.</li>
        <li>Publish bonus assignments from the <strong>Level Up</strong> page in the sidebar — they appear in a &ldquo;Bonus Assignments&rdquo; section.</li>
        <li>Students see published bonus assignments in their Level Up page with skill tags displayed.</li>
      </DocList>

      <DocH2>Grades Overview</DocH2>
      <DocP>
        The <strong>Grades</strong> link in the sidebar opens the course-wide grades view. A yellow number badge
        on the sidebar link shows how many submissions need grading — visible from any page in the course.
      </DocP>
      <DocP>The grades view has two tabs:</DocP>
      <DocList>
        <li><strong>By Assignment</strong> — all assignments grouped by module, each showing turned-in count, ungraded badge, and complete/incomplete breakdown</li>
        <li><strong>By Student</strong> — each student with their missing, needs-grading, incomplete, and complete counts; click any count to expand the assignment list inline</li>
      </DocList>
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
        <li>Click <strong>✓ Complete</strong> or <strong>✗ Revision</strong> to grade inline — the item disappears immediately.</li>
        <li>Click <strong>View</strong> to open the full submission when you need to read the work first.</li>
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
        <li>Click <strong>Complete</strong> or <strong>Incomplete</strong> — the page automatically advances to the next ungraded student after you grade.</li>
        <li>The nav strip shows <strong>N need grading</strong> so you always know your progress for this assignment.</li>
        <li>Use the <strong>← / →</strong> links in the nav strip to browse all students (not just ungraded).</li>
        <li>The answer key, checklist review, comments, and submission history are all on the same page.</li>
      </DocList>
      <DocNote>
        Auto-advance only happens when grading for the <em>first time</em> (null → complete/incomplete). Changing or
        removing an existing grade stays on the same page.
      </DocNote>

      <DocH3>Instructor Checklist Review</DocH3>
      <DocP>
        On the grading page you see the same checklist the student used. Review which items they checked off and use that
        alongside their submission to inform your grade.
      </DocP>

      <DocH3>Comments</DocH3>
      <DocP>
        Add a comment to explain your grade or provide specific feedback. Comments are visible to the student immediately.
        They appear below the submission form on the student&apos;s assignment page.
      </DocP>

      <DocH2>Mark Complete Without Submission</DocH2>
      <DocP>
        For assignments without a submission requirement, mark a student&apos;s assignment as complete directly from the
        submissions list — no student submission required.
      </DocP>

      <DocH2>Submission History</DocH2>
      <DocP>
        All submissions (including resubmissions) are stored. On the grading page you can see the full history of a
        student&apos;s submissions to track revisions.
      </DocP>

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
        TAs see a <strong>Grade for My Group</strong> count badge showing only their own ungraded submissions.
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
