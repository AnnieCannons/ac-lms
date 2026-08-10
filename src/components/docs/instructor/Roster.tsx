import { DocH3, DocP, DocList, DocOL, DocTip, DocNote, DocStep, DocCode } from '@/components/docs/DocComponents'
import { DocAccordion } from '@/components/docs/DocAccordion'

export default function Roster() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Roster &amp; Student Progress</h1>
      <p className="text-sm text-muted-text mb-8">Track individual student progress and grade inline from one view.</p>

      <DocAccordion
        items={[
          {
            id: 'overview',
            title: 'The Roster Page',
            content: (
              <>
                <DocP>
                  Navigate to <strong>Roster</strong> in the course sidebar. It lists every student and observer with
                  an active enrollment in the course &mdash; not just students with accommodations &mdash; in a table
                  with <strong>Name</strong>, <strong>Email</strong>, and <strong>Accommodations</strong> columns.
                </DocP>
                <DocP>
                  If you have access to more than one course, tabs across the top let you switch between them (the
                  current course is highlighted). TAs only see their own course, so the tabs are hidden for them.
                </DocP>
                <DocP>
                  Below the tabs, a count line shows how many students are enrolled, plus a red &ldquo;camera
                  off&rdquo; count if any students currently have an active Camera Off accommodation. If nobody is
                  enrolled yet, the page shows &ldquo;No students enrolled in this course.&rdquo; Students are listed
                  alphabetically by name.
                </DocP>
                <DocNote>
                  Students whose enrollment role is <DocCode>observer</DocCode> are split into a separate
                  &ldquo;Observers &mdash; On Leave&rdquo; table below the main roster, with their own count
                  (&ldquo;N students paused&rdquo;). They still get the same accommodation badges and Student Detail
                  View as regular students.
                </DocNote>
              </>
            ),
          },
          {
            id: 'accommodations',
            title: 'Setting Accommodations',
            content: (
              <>
                <DocP>
                  Each student row shows badges for any accommodations on file:
                </DocP>
                <DocList>
                  <li><strong>Camera Off</strong> &mdash; a red circular badge. It&apos;s solid red while active and lighter red when scheduled to start on a future date. Click it to reopen the Camera Off Dates popover.</li>
                  <li><strong>Accommodations</strong> &mdash; an amber pill for any other accommodation notes. Click it to reopen the notes.</li>
                </DocList>
                <DocP>
                  Rows with any accommodation set are tinted amber so they stand out in the list.
                </DocP>

                <DocH3>Adding a new accommodation</DocH3>
                <DocStep number={1}>
                  Click the <strong>+</strong> button at the right of the student&apos;s row (tooltip: &ldquo;Add
                  accommodation&rdquo;). This button isn&apos;t shown to TAs &mdash; they get a read-only view.
                </DocStep>
                <DocStep number={2}>
                  Choose <strong>Camera Off</strong> or <strong>Other Accommodation</strong> from the menu.
                </DocStep>
                <DocStep number={3}>
                  For Camera Off, pick a <strong>Start date</strong> and/or <strong>End date</strong> (either can be
                  left blank for an open-ended accommodation) and click <strong>Save dates</strong>. For Other
                  Accommodation, type the details into the rich text editor and click <strong>Save</strong>.
                </DocStep>
                <DocP>
                  To edit an existing accommodation, click its badge instead of the + button &mdash; it opens the
                  same popover pre-filled. To remove a Camera Off accommodation entirely, reopen its popover and click
                  <strong> Remove</strong>.
                </DocP>
                <DocNote>
                  Accommodations are stored on the student&apos;s account, not per course &mdash; setting one here
                  applies everywhere that student is enrolled. As an instructor, you can only set accommodations for
                  students who share at least one course with you. TAs can still click a badge to view its details
                  in a read-only popover; they just don&apos;t get the + button to add new ones or edit existing
                  ones.
                </DocNote>
                <DocTip>
                  A Camera Off accommodation clears itself automatically the day after its End date passes (Pacific
                  time) &mdash; there&apos;s no need to remember to turn it off.
                </DocTip>
              </>
            ),
          },
          {
            id: 'detail',
            title: 'Student Detail View',
            content: (
              <>
                <DocP>
                  Open a student&apos;s full progress picture from either of these two places:
                </DocP>
                <DocList>
                  <li>The <strong>Roster</strong> page &mdash; click any student name</li>
                  <li><strong>Grades &rarr; By Student</strong> tab &mdash; click any student name in the course-wide grades view</li>
                </DocList>
                <DocP>
                  The URL follows the pattern <DocCode>/instructor/courses/[course-id]/roster/[student-id]</DocCode> and
                  can be shared directly with another instructor or TA on the same course.
                </DocP>
                <DocP>
                  The page opens with a header card showing the student&apos;s name, email, and a role badge
                  (Instructor in purple, Admin in orange, everyone else in teal), followed by:
                </DocP>
                <DocList>
                  <li><strong>Last login</strong> &mdash; date and time of their last sign-in, or &ldquo;Never logged in&rdquo;</li>
                  <li><strong>Accommodations</strong> &mdash; &ldquo;None,&rdquo; or the same Camera Off / notes badges as the roster</li>
                  <li><strong>Progress</strong> &mdash; &ldquo;X / Y complete&rdquo;</li>
                </DocList>
                <DocNote>
                  The Y in Progress counts every published assignment and quiz the student has an active status on
                  &mdash; missing, needing grading, needing revision, or complete. It excludes work that isn&apos;t
                  due yet and hasn&apos;t been started, and it skips anything excused via an assignment override
                  entirely.
                </DocNote>
                <DocP>
                  If you&apos;re signed in as an admin, a <strong>View as Student</strong> button appears next to the
                  back link, letting you preview the course from that student&apos;s perspective.
                </DocP>
              </>
            ),
          },
          {
            id: 'grading',
            title: 'Grading from the Student Detail View',
            content: (
              <>
                <DocP>
                  Below the header, a <strong>Breakdown</strong> section shows four color-coded stat cards:
                </DocP>
                <DocList>
                  <li><strong>Missing</strong> (red) &mdash; past-due, with no submission yet</li>
                  <li><strong>Needs Grading</strong> (teal) &mdash; submitted and waiting for your review</li>
                  <li><strong>Needs Revision</strong> (orange) &mdash; graded as incomplete; the student should revise and resubmit</li>
                  <li><strong>Complete</strong> (green) &mdash; graded as complete</li>
                </DocList>
                <DocP>
                  Empty cards are dimmed and can&apos;t be clicked. Clicking a card with items expands the list below
                  it; clicking it again collapses it. Each item in the list shows its module and week, due date, a
                  &ldquo;Quiz&rdquo; badge and score if it&apos;s a quiz, and a &ldquo;Late&rdquo; badge if it was
                  submitted after the due date.
                </DocP>
                <DocOL>
                  <li>Click a non-empty stat card to expand its list.</li>
                  <li>
                    In the <strong>Needs Grading</strong> list only, click <strong>&#10007; Revision</strong> on an
                    item to mark it as needing revision immediately &mdash; it moves to Needs Revision without leaving
                    the page.
                  </li>
                  <li>
                    Click <strong>View</strong>, <strong>View &rarr;</strong>, or <strong>Grade &rarr;</strong>
                    (whichever is shown) to open the full submission page instead &mdash; needed to read the
                    student&apos;s work, leave a comment, or mark something Complete.
                  </li>
                </DocOL>
                <DocNote>
                  There&apos;s no inline &ldquo;mark complete&rdquo; action on this page &mdash; only the Needs
                  Grading list gets a quick button, and it only marks Needs Revision. Marking something Complete
                  always requires opening the full submission page. Quiz items always link to Quiz Submissions
                  instead, since quizzes are graded there.
                </DocNote>
                <DocP>
                  Late submissions are tracked separately: a <strong>N Late Submissions</strong> bar below the stat
                  cards expands (&ldquo;&#9660; Show&rdquo; / &ldquo;&#9650; Hide&rdquo;) into a list of every late
                  item, each with its current status if it&apos;s been graded and a <strong>View &rarr;</strong> link
                  &mdash; there&apos;s no quick-grade button here, since an item can be late and in any other category
                  at the same time.
                </DocP>
                <DocTip>
                  Use this view during 1-on-1 check-ins to see exactly where a student stands and knock out quick
                  Needs Revision calls without switching pages.
                </DocTip>
              </>
            ),
          },
        ]}
      />
    </>
  )
}
