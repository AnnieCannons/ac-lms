import { DocH2, DocH3, DocP, DocList, DocOL, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'

export default function Assignments() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Assignments & Grading</h1>
      <p className="text-sm text-muted-text mb-8">Create assignments, review submissions, and leave feedback.</p>

      <DocH2>Creating an Assignment</DocH2>
      <DocStep number={1}>In the Course Editor, expand the module and find the target day.</DocStep>
      <DocStep number={2}>Click <strong>+ Add Assignment</strong>.</DocStep>
      <DocStep number={3}>Enter a title and click Save.</DocStep>
      <DocStep number={4}>Click the assignment title to open the full assignment editor.</DocStep>

      <DocH2>Assignment Editor</DocH2>
      <DocP>The assignment editor has several sections:</DocP>
      <DocList>
        <li><strong>Instructions</strong> — rich-text field; supports formatting, code blocks, links, and images</li>
        <li><strong>Checklist Items</strong> — add self-assessment criteria that students check off before submitting</li>
        <li><strong>Submission Required</strong> — toggle on if students must upload a link/text/file; toggle off for completion-only assignments</li>
        <li><strong>Due Date</strong> — optional; shown to students on the assignment page and list</li>
        <li><strong>Published</strong> — controls student visibility</li>
      </DocList>

      <DocTip>
        Use the checklist to communicate rubric expectations. Students see the same checklist and check items off before
        submitting, which helps them self-review before you grade.
      </DocTip>

      <DocH2>Viewing Submissions</DocH2>
      <DocP>
        Navigate to <strong>Assignments</strong> in the course sidebar. Each assignment shows a submission count. Click
        an assignment to see the list of student submissions.
      </DocP>
      <DocNote>
        Only submitted (not draft) submissions appear in the grading queue.
      </DocNote>

      <DocH2>Grading</DocH2>
      <DocP>Open a student&apos;s submission to review their work and leave a grade.</DocP>
      <DocList>
        <li><strong>Complete</strong> — the student has met the requirements</li>
        <li><strong>Needs Revision</strong> — the student should revise and resubmit</li>
      </DocList>

      <DocH3>Instructor Checklist Review</DocH3>
      <DocP>
        On the grading page you see the same checklist the student used. Review which items they checked off and use that
        alongside their submission to inform your grade.
      </DocP>

      <DocH3>Comments</DocH3>
      <DocP>
        Add a comment to explain your grade or provide specific feedback. Comments are visible to the student immediately
        after you save. They appear below the submission form on the student&apos;s assignment page.
      </DocP>

      <DocH2>Mark Complete Without Submission</DocH2>
      <DocP>
        For assignments without a submission requirement, you can mark a student&apos;s assignment as complete directly
        from the assignment submissions list without needing a student submission.
      </DocP>

      <DocH2>Submission History</DocH2>
      <DocP>
        All submissions (including resubmissions) are stored. On the grading page you can see the full history of a
        student&apos;s submissions to track revisions.
      </DocP>
    </>
  )
}
