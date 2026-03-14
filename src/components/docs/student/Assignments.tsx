import { DocH2, DocH3, DocP, DocList, DocOL, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'

export default function Assignments() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Assignments</h1>
      <p className="text-sm text-muted-text mb-8">How to submit your work, track grades, and respond to feedback.</p>

      <DocH2>Finding Assignments</DocH2>
      <DocP>Assignments are accessible from three places:</DocP>
      <DocList>
        <li>The <strong>Assignments</strong> page in the sidebar — lists all assignments across the course</li>
        <li>Day cards in the <strong>Course Outline</strong> — shows assignments due on a specific day</li>
        <li>The <strong>day detail page</strong> — full list of that day&apos;s content</li>
      </DocList>

      <DocH2>Reading Instructions</DocH2>
      <DocP>
        Click any assignment title to open the assignment detail page. You&apos;ll find the full instructions, any
        resources your instructor attached, and a checklist (if provided) for self-assessment before submitting.
      </DocP>

      <DocH2>Submitting Your Work</DocH2>
      <DocP>Your instructor will specify which type of submission is required:</DocP>
      <DocList>
        <li><strong>Link</strong> — paste a URL (e.g., a GitHub repo or live site)</li>
        <li><strong>Text</strong> — type or paste your response directly in the text box</li>
        <li><strong>File</strong> — upload a file from your computer</li>
        <li><strong>No submission required</strong> — some assignments are completion-based; just mark the checklist</li>
      </DocList>

      <DocH3>Step-by-Step: Submitting</DocH3>
      <DocStep number={1}>Open the assignment page.</DocStep>
      <DocStep number={2}>Fill in your submission (link, text, or file).</DocStep>
      <DocStep number={3}>Complete the self-assessment checklist if one is provided.</DocStep>
      <DocStep number={4}>Click <strong>Submit</strong>. Your submission is sent to your instructor.</DocStep>

      <DocTip>
        You can save a draft at any time by clicking <strong>Save Draft</strong>. Drafts are not visible to your
        instructor until you click Submit.
      </DocTip>

      <DocH2>Checklist Self-Assessment</DocH2>
      <DocP>
        Many assignments include a checklist of requirements. Go through each item and check it off before submitting.
        This helps you self-assess your work and shows your instructor you reviewed the criteria.
      </DocP>
      <DocNote>
        Checking off checklist items does not automatically submit your assignment. You still need to click
        <strong> Submit</strong>.
      </DocNote>

      <DocH2>Grades and Feedback</DocH2>
      <DocP>After your instructor reviews your submission, you&apos;ll see one of two grades:</DocP>
      <DocList>
        <li><strong>Complete</strong> — your work meets the requirements</li>
        <li><strong>Needs Revision</strong> — your instructor has feedback; review their comments and resubmit</li>
      </DocList>

      <DocH3>Instructor Comments</DocH3>
      <DocP>
        Comments from your instructor appear below the submission form on the assignment page. Read them carefully —
        they explain what to improve when resubmitting.
      </DocP>

      <DocH3>Resubmitting</DocH3>
      <DocOL>
        <li>Read your instructor&apos;s feedback in the comments section.</li>
        <li>Update your submission (edit the link, text, or upload a new file).</li>
        <li>Click <strong>Resubmit</strong>.</li>
      </DocOL>
      <DocP>
        There is no limit on the number of resubmissions unless your instructor specifies otherwise.
      </DocP>

      <DocH2>Submission History</DocH2>
      <DocP>
        Every time you submit, the previous submission is saved. You can view your submission history by scrolling to the
        bottom of the assignment page. This lets you track your progress and see what changed between submissions.
      </DocP>

      <DocH2>Historical Submissions from Canvas</DocH2>
      <DocP>
        If your program previously used Canvas, your past submissions and instructor comments have been imported into the
        LMS. They appear in the submission history section of each assignment page — you can review your earlier work and
        any feedback you received at any time.
      </DocP>
      <DocTip>
        If you expect to see a past submission but don&apos;t, check that you are viewing the correct course and
        assignment. Contact your instructor if something appears to be missing.
      </DocTip>
    </>
  )
}
