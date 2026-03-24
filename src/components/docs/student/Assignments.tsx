import { DocH2, DocH3, DocP, DocList, DocOL, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'

export default function Assignments() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Assignments</h1>
      <p className="text-sm text-muted-text mb-8">How to find your work, submit it, understand your grades, and respond to feedback.</p>

      <DocH2>Finding Assignments</DocH2>
      <DocP>Assignments are accessible from three places:</DocP>
      <DocList>
        <li>The <strong>Assignments</strong> page in the sidebar — lists every assignment across the course, grouped by week, each showing its current status</li>
        <li>The <strong>Course Outline</strong> — click any day row to expand it and see assignments, resources, and quizzes for that day</li>
      </DocList>

      <DocH2>Your Assignments List</DocH2>
      <DocP>
        The <strong>Assignments</strong> page in the sidebar shows every assignment in the course with a status badge so you can see at a glance where you stand:
      </DocP>
      <DocList>
        <li><strong>Not started</strong> (grey) — you haven&apos;t begun this assignment yet</li>
        <li><strong>Draft</strong> — you&apos;ve saved a draft but haven&apos;t submitted yet</li>
        <li><strong>Turned in</strong> (teal) — you submitted and your instructor hasn&apos;t graded it yet</li>
        <li><strong>Complete ✓</strong> (green) — your instructor graded it as complete</li>
        <li><strong>Needs Revision</strong> (red) — your instructor has feedback; read their comments and resubmit</li>
        <li><strong>Late</strong> (amber) — shown alongside the status badge when the due date has passed</li>
      </DocList>

      <DocH3>Filtering Your Assignments</DocH3>
      <DocP>
        Use the filter tabs at the top of the Assignments page to focus on what needs attention:
      </DocP>
      <DocList>
        <li><strong>All</strong> — every assignment, grouped by module</li>
        <li><strong>Needs Revision</strong> — assignments your instructor graded as needing revision; read their feedback and resubmit</li>
        <li><strong>Not Started</strong> — assignments you haven&apos;t touched yet, split into two sections: <em>Past Due</em> (overdue) at the top, then <em>Upcoming</em> below</li>
        <li><strong>Turned In</strong> — submitted work waiting to be graded</li>
        <li><strong>Complete</strong> — everything you&apos;ve finished</li>
      </DocList>
      <DocTip>
        Start your day by checking <strong>Needs Revision</strong> first, then <strong>Not Started → Past Due</strong>.
        These are the two places where action is needed most.
      </DocTip>

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
        <li><strong>No submission required</strong> — some assignments are completion-based; just fill in the checklist and submit</li>
      </DocList>

      <DocH3>Step-by-Step: Submitting</DocH3>
      <DocStep number={1}>Open the assignment page.</DocStep>
      <DocStep number={2}>Fill in your submission (link, text, or file).</DocStep>
      <DocStep number={3}>Complete the self-assessment checklist if one is provided.</DocStep>
      <DocStep number={4}>Click <strong>Submit</strong>. Your submission is sent to your instructor.</DocStep>

      <DocTip>
        You can save a draft at any time by clicking <strong>Save Draft</strong>. Drafts are private — your instructor
        cannot see them until you click Submit.
      </DocTip>

      <DocH2>Checklist Self-Assessment</DocH2>
      <DocP>
        Many assignments include a checklist of requirements. Go through each item and check it off before submitting.
        This is for your own self-review — it helps you make sure your work is ready and shows your instructor you
        reviewed the criteria before turning in.
      </DocP>
      <DocNote>
        Checking off checklist items does not automatically submit your assignment. You still need to click
        <strong> Submit</strong>.
      </DocNote>

      <DocH2>Grades and Feedback</DocH2>
      <DocP>After your instructor reviews your submission, you&apos;ll see one of two grades:</DocP>
      <DocList>
        <li><strong>Complete</strong> — your work meets the requirements. Well done.</li>
        <li><strong>Needs Revision</strong> — your instructor has feedback. This is a normal part of learning — it means there&apos;s something specific to improve, and you can resubmit.</li>
      </DocList>
      <DocTip>
        A &ldquo;Needs Revision&rdquo; grade is not a failure. It means your instructor took the time to review your work and
        has specific guidance to help you grow. Read their comments, make your updates, and resubmit.
      </DocTip>

      <DocH3>Comments</DocH3>
      <DocP>
        A comment thread lives below the submission form on every assignment page. Your instructor can start the conversation,
        or you can — either way the other person will see it and can reply.
      </DocP>
      <DocList>
        <li>You can add a comment <strong>before or after submitting</strong> — use it to ask a question, flag something about your submission, or provide context for your instructor.</li>
        <li>Comments are visible to you and your instructor only — not to other students.</li>
        <li>You can <strong>edit or delete your own comments</strong> at any time by hovering over a comment to reveal the Edit and Delete options.</li>
        <li>Deleting asks for a quick inline confirmation before removing the comment.</li>
        <li>You can submit a comment with <strong>Ctrl + Enter</strong> (or <strong>Cmd + Enter</strong> on Mac).</li>
      </DocList>
      <DocNote>
        The Send button is disabled until you have submitted your assignment. You can type a comment in advance — it will be ready to send once your submission goes through.
      </DocNote>

      <DocH3>Resubmitting</DocH3>
      <DocOL>
        <li>Read your instructor&apos;s feedback in the comments section.</li>
        <li>Update your submission — edit the link or text, or upload a new file.</li>
        <li>Click <strong>Resubmit</strong>.</li>
      </DocOL>
      <DocP>
        There is no limit on the number of resubmissions unless your instructor specifies otherwise. Take the time you need.
      </DocP>

      <DocH2>Submission History</DocH2>
      <DocP>
        Every time you submit, the previous version is saved. Scroll to the bottom of the assignment page to see your full
        submission history — you can review what you turned in at each stage and how your work evolved.
      </DocP>

      <DocH2>Historical Submissions from Canvas</DocH2>
      <DocP>
        If your program previously used Canvas, your past submissions and instructor comments have been imported into the
        LMS. They appear in the submission history section of each assignment page — you can review your earlier work and
        any feedback you received at any time.
      </DocP>
      <DocTip>
        If you expect to see a past submission but don&apos;t, check that you are on the correct course and assignment page.
        Contact your instructor if something appears to be missing.
      </DocTip>

      <DocH2>Level Up Your Skills</DocH2>
      <DocP>
        <strong>Level Up Your Skills</strong> is a section in the sidebar with optional bonus assignments. These are not
        required — they are extra practice opportunities for students who want to go deeper on a topic or explore
        something new.
      </DocP>
      <DocList>
        <li>Bonus assignments are clearly labeled and separate from your main coursework</li>
        <li>They do not affect your standing if you skip them</li>
        <li>If you complete one and it gets graded as <strong>Complete</strong>, it will appear in your assignment history</li>
        <li>Skill tags on each bonus assignment tell you which skills it covers</li>
      </DocList>
      <DocNote>
        The Level Up section only appears when your instructor has published bonus assignments for your course.
      </DocNote>
    </>
  )
}
