import { DocH3, DocP, DocList, DocOL, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'
import { DocAccordion } from '@/components/docs/DocAccordion'

export default function Assignments() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Assignments</h1>
      <p className="text-sm text-muted-text mb-8">How to find your work, submit it, understand your grades, and respond to feedback.</p>

      <DocAccordion
        items={[
          {
            id: 'finding',
            title: 'Finding Your Assignments',
            content: (
              <>
                <DocP>Assignments are accessible from two places:</DocP>
                <DocList>
                  <li>The <strong>Grades</strong> page in the sidebar — lists every assignment across the course, grouped by module, each showing its current status</li>
                  <li>The <strong>Course Outline</strong> — click a module, then click a day to expand it in place and see the assignments, resources, and quizzes for that day</li>
                </DocList>

                <DocH3>The Grades Page</DocH3>
                <DocP>
                  Every assignment gets a status badge so you can see at a glance where you stand:
                </DocP>
                <DocList>
                  <li><strong>Not Started</strong> — you haven&apos;t submitted or saved a draft yet</li>
                  <li><strong>Turned In</strong> — you submitted and your instructor hasn&apos;t graded it yet</li>
                  <li><strong>Complete ✓</strong> — your instructor graded it as complete</li>
                  <li><strong>Needs Revision</strong> — your instructor has feedback; read their comments and resubmit</li>
                  <li><strong>Late</strong> — shown alongside the status badge once the due date has passed and you haven&apos;t submitted</li>
                  <li><strong>Excused</strong> — your instructor excused you from this assignment; it won&apos;t count against you</li>
                </DocList>
                <DocP>
                  Use the <strong>Search assignments…</strong> box at the top to jump straight to an assignment by title.
                </DocP>

                <DocH3>Filtering Your Assignments</DocH3>
                <DocP>
                  Below the search box, filter tabs let you focus on what needs attention. Each tab shows a count of
                  matching assignments:
                </DocP>
                <DocList>
                  <li><strong>All</strong> — every assignment, grouped by module</li>
                  <li><strong>Needs Revision</strong> — assignments your instructor graded as needing revision</li>
                  <li><strong>Not Started</strong> — split into two collapsible sections: <strong>Past Due</strong> at the top, then <strong>Upcoming</strong> below (excused assignments are left out of this tab)</li>
                  <li><strong>Turned In</strong> — submitted work waiting to be graded</li>
                  <li><strong>Complete ✓</strong> — everything you&apos;ve finished</li>
                  <li><strong>Level Up</strong> — your optional bonus assignments (see Level Up Your Skills below)</li>
                </DocList>
                <DocTip>
                  Start your day by checking <strong>Needs Revision</strong> first, then <strong>Not Started → Past Due</strong>.
                  These are the two places where action is needed most.
                </DocTip>
              </>
            ),
          },
          {
            id: 'assignment-page',
            title: 'The Assignment Page',
            content: (
              <>
                <DocP>
                  Click any assignment title to open its detail page. Near the top you&apos;ll see the assignment title,
                  any skill tags and a purple <strong>Bonus</strong> pill if it&apos;s optional, your current grade or
                  status badge, and — once a due date passes — a <strong>Late</strong> or <strong>Excused</strong> pill
                  next to the due date.
                </DocP>

                <DocH3>Instructions and How to Turn This In</DocH3>
                <DocP>
                  The <strong>Instructions</strong> card holds the full assignment description. If your instructor added
                  turn-in notes, a separate <strong>How to turn this in</strong> card appears below it with those details.
                </DocP>

                <DocH3>Requesting an Extension</DocH3>
                <DocP>
                  If you need more time, use the <strong>Request Extension</strong> button above the instructions:
                </DocP>
                <DocStep number={1}>Click <strong>Request Extension</strong>.</DocStep>
                <DocStep number={2}>Choose a reason under &ldquo;Why do you need an extension?&rdquo; (or select <strong>Other</strong> and describe it).</DocStep>
                <DocStep number={3}>Check at least one option under &ldquo;What will you do to complete the assignment?&rdquo; — <strong>Make time in my calendar</strong>, <strong>Ask for help</strong>, or <strong>Other</strong>.</DocStep>
                <DocStep number={4}>Pick a new date on the calendar for &ldquo;When will the assignment be done?&rdquo; It defaults to 11:59pm ET on the day you choose.</DocStep>
                <DocStep number={5}>Add any extra context in the optional notes field, then click <strong>Submit Request</strong>.</DocStep>
                <DocP>
                  The button becomes a status pill — <strong>Extension: Pending</strong>, <strong>Extension: Approved</strong>,
                  or <strong>Extension: Not Approved</strong>. Click it to see your instructor&apos;s note (if they left one).
                  While a request is pending, you can click it and choose <strong>Cancel this request</strong> to withdraw it.
                </DocP>

                <DocH3>The Checklist</DocH3>
                <DocP>
                  Many assignments include a checklist above the submission form. Check off each item as you complete it —
                  the card shows how many required items you&apos;ve checked (e.g. &ldquo;2/3 required checked&rdquo;).
                  Items your instructor marked optional carry an amber <strong>Bonus</strong> tag and don&apos;t count
                  toward that total.
                </DocP>
                <DocNote>
                  If the checklist has required items, the <strong>Submit</strong> button stays disabled until every one
                  of them is checked. Checking items off does not submit your assignment by itself — you still need to
                  click <strong>Submit</strong>.
                </DocNote>
                <DocP>
                  After your instructor reviews your submission, each checklist item may pick up an <strong>Approved</strong>
                  or <strong>Revise</strong> mark next to your own checkmark, so you can see exactly which parts they
                  confirmed.
                </DocP>
              </>
            ),
          },
          {
            id: 'submitting',
            title: 'Submitting, Saving, and Resubmitting',
            content: (
              <>
                <DocP>
                  Some assignments don&apos;t need a submission at all — your instructor checks those off directly, and
                  no Turn In form or checklist appears for you. If a Turn In card does appear, pick one of three tabs:
                </DocP>
                <DocList>
                  <li><strong>Link (URL)</strong> — paste a URL (e.g. a GitHub repo or live site); it must start with <code>http://</code> or <code>https://</code></li>
                  <li><strong>Text</strong> — type your response directly; supports <strong>bold</strong>, <em>italic</em>, <code>code</code>, lists, and links, with a <strong>Preview</strong> toggle to check the formatting</li>
                  <li><strong>File upload</strong> — upload a document, spreadsheet, presentation, zip/tar archive, or image (10MB limit)</li>
                </DocList>

                <DocH3>Step-by-Step: Submitting</DocH3>
                <DocStep number={1}>Open the assignment page and scroll to the <strong>Turn In</strong> card.</DocStep>
                <DocStep number={2}>Choose a tab — <strong>Link (URL)</strong>, <strong>Text</strong>, or <strong>File upload</strong> — and fill it in.</DocStep>
                <DocStep number={3}>Check off any required checklist items above the form.</DocStep>
                <DocStep number={4}>Click <strong>Submit</strong>. Your submission is sent to your instructor and the card&apos;s badge changes to <strong>Turned in</strong>.</DocStep>
                <DocTip>
                  You can save a draft at any time by clicking <strong>Save draft</strong> instead of Submit. Drafts are
                  private — your instructor cannot see them until you click Submit.
                </DocTip>

                <DocH3>Resubmitting</DocH3>
                <DocP>
                  Once you have a saved submission, the button under it reads <strong>Edit</strong> (if it&apos;s still a
                  draft) or <strong>Resubmit</strong> (if it&apos;s been submitted or graded). This button disappears once
                  your instructor marks the assignment <strong>Complete ✓</strong> — after that you can no longer edit it.
                </DocP>
                <DocOL>
                  <li>Read your instructor&apos;s feedback in the comments section.</li>
                  <li>
                    Click <strong>Edit</strong> or <strong>Resubmit</strong>. For a link submission that&apos;s already
                    been turned in, you&apos;ll first see &ldquo;Is your link the same as before?&rdquo; — choose{' '}
                    <strong>Yes, resubmit same</strong> to resend it as-is, or <strong>No, I&apos;ll enter a new one</strong>{' '}
                    to open the form and enter a different link. Text and file submissions skip this prompt and go
                    straight to the form.
                  </li>
                  <li>Update your content, then click <strong>Submit</strong> again.</li>
                </DocOL>
                <DocP>
                  There is no limit on the number of resubmissions while an assignment is ungraded or marked
                  <strong> Needs Revision</strong>. Take the time you need.
                </DocP>
              </>
            ),
          },
          {
            id: 'grades-and-comments',
            title: 'Grades, Comments, and History',
            content: (
              <>
                <DocH3>Your Grade</DocH3>
                <DocP>After your instructor reviews your submission, you&apos;ll see one of two grades:</DocP>
                <DocList>
                  <li><strong>Complete</strong> — your work meets the requirements. Well done.</li>
                  <li><strong>Needs Revision</strong> — your instructor has feedback. This is a normal part of learning — it means there&apos;s something specific to improve, and you can resubmit.</li>
                </DocList>
                <DocTip>
                  A &ldquo;Needs Revision&rdquo; grade is not a failure. It means your instructor took the time to review your work and
                  has specific guidance to help you grow. Read their comments, make your updates, and resubmit.
                </DocTip>
                <DocP>
                  If your grade has changed more than once, a <strong>Grade History</strong> card below the submission
                  form lists every grade you&apos;ve received in order, each with its date — with a count of how many
                  times you&apos;ve been marked <strong>Incomplete</strong> along the way.
                </DocP>

                <DocH3>Comments</DocH3>
                <DocP>
                  A <strong>Comments</strong> thread lives below the Turn In card on every assignment page. Your instructor
                  can start the conversation, or you can — either way the other person will see it and can reply.
                </DocP>
                <DocList>
                  <li>The comment box unlocks as soon as you&apos;ve saved a submission — a draft counts, not just a full submit.</li>
                  <li>Comments are visible to you and your instructor only — not to other students.</li>
                  <li>Type your comment and click <strong>Save Comment</strong>, or press <strong>Ctrl + Enter</strong> (<strong>Cmd + Enter</strong> on Mac) to save it without leaving the box. Use the emoji button below the box to add an emoji.</li>
                  <li>Hover over your own comment to reveal <strong>Edit</strong> and <strong>Delete</strong> — deleting asks for a quick inline &ldquo;Delete?&rdquo; confirmation first.</li>
                  <li>Your instructor can also delete any comment in the thread, including yours.</li>
                </DocList>

                <DocH3>Submission History</DocH3>
                <DocP>
                  Every time you submit, the previous version is kept. Once you have more than one submission, a
                  &ldquo;Past Submissions&rdquo; list appears at the bottom of the Turn In card so you can review what you
                  turned in at each stage and how your work evolved.
                </DocP>
                <DocP>
                  If your program previously used Canvas, your past submissions and instructor comments from before the
                  move were imported into the LMS and appear in this same history list. Contact your instructor if you
                  expect to see an old submission there and don&apos;t.
                </DocP>
              </>
            ),
          },
          {
            id: 'level-up',
            title: 'Level Up Your Skills',
            content: (
              <>
                <DocP>
                  <strong>Level Up Your Skills</strong>, in the sidebar under Course, is where optional bonus content
                  lives — extra practice for students who want to go deeper on a topic or explore something new. It
                  always appears in the sidebar, even when your instructor hasn&apos;t published anything there yet.
                </DocP>
                <DocList>
                  <li>Use the <strong>Search Level Up…</strong> box, or click a skill-tag pill (or <strong>All</strong>), to narrow down the modules shown.</li>
                  <li>A separate <strong>Bonus Assignments</strong> list below the modules covers optional assignments attached to your regular coursework rather than to a Level Up module — each shows its skill tags, due date, and a <strong>View →</strong> link.</li>
                  <li>Bonus work is clearly marked with a purple <strong>Bonus</strong> pill. An unsubmitted bonus assignment never shows a Late badge, even past its due date — but if you submit one after the due date, it can still show a <strong>Late</strong> tag next to <strong>Turned In</strong>, same as a regular assignment. Your instructor grades it the same way as any other assignment.</li>
                  <li>You can also reach all of it from the Grades page: the <strong>Level Up</strong> filter tab pulls together the same bonus and Level Up assignments alongside your regular grade view.</li>
                </DocList>
                <DocNote>
                  Skipping Level Up content never affects your standing. If you complete a bonus assignment and it&apos;s
                  graded <strong>Complete ✓</strong>, it shows up in your Grades history like any other assignment.
                </DocNote>
              </>
            ),
          },
        ]}
      />
    </>
  )
}
