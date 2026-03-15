import { DocH2, DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'

export default function GettingStarted() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Getting Started</h1>
      <p className="text-sm text-muted-text mb-8">An overview of the instructor experience in AC-LMS.</p>

      <DocH2>Instructor Dashboard</DocH2>
      <DocP>
        After logging in you land on the <strong>Courses</strong> page, which lists every course you have access to.
        Courses that are currently running show a green <strong>Current</strong> badge based on the start date and a
        15-week window.
      </DocP>
      <DocList>
        <li>Click <strong>Manage →</strong> to open a course</li>
        <li>Click <strong>Edit Dates</strong> to set or update start and end dates using a calendar picker</li>
        <li>Click <strong>Duplicate</strong> to copy a course with optional due-date shifting</li>
        <li>Click <strong>+ New Course</strong> to create a new course from scratch</li>
      </DocList>

      <DocH2>Duplicating a Course</DocH2>
      <DocP>
        Clicking <strong>Duplicate</strong> on any course opens a modal where you can configure the copy before it is
        created.
      </DocP>
      <DocList>
        <li><strong>Course Name</strong> — pre-filled as &ldquo;Copy of [original name]&rdquo;; edit as needed</li>
        <li><strong>Course Code</strong> — pre-filled by incrementing the original code&apos;s suffix (e.g. <em>BE-2026</em> → <em>BE-2027</em>); must be unique</li>
      </DocList>

      <DocH3>Date Shifting</DocH3>
      <DocP>
        If you enter both an <strong>Original Start Date</strong> and a <strong>New Start Date</strong>, all assignment
        due dates are shifted by the difference between the two. Leave both blank to keep the original dates unchanged.
      </DocP>
      <DocStep number={1}>Enter the date the original course started (or confirm the pre-filled value).</DocStep>
      <DocStep number={2}>Enter the start date for the new cohort.</DocStep>
      <DocStep number={3}>Click <strong>Duplicate Course →</strong>. The new course opens automatically.</DocStep>
      <DocTip>
        Date shifting is purely arithmetic — it moves every assignment due date by the same number of days as the
        difference between the two start dates. Review due dates after duplicating to catch any assignments that may
        land on holidays or weekends.
      </DocTip>

      <DocH3>What Gets Copied</DocH3>
      <DocList>
        <li>All modules, days, and their structure</li>
        <li>All assignments (including instructions, checklist items, and publish status)</li>
        <li>All resources attached to days</li>
        <li>Course sections (syllabus, info pages)</li>
      </DocList>

      <DocH3>What Does Not Get Copied</DocH3>
      <DocList>
        <li><strong>Quizzes</strong> — must be recreated or pasted in the new course</li>
        <li><strong>Student enrollments</strong> — the new course starts empty; add students separately</li>
        <li><strong>Submissions and grades</strong> — no student data is carried over</li>
        <li><strong>Grading groups</strong> — reset for the new cohort</li>
        <li><strong>Career Dev cross-posts</strong> — career dev content exists only in the source course; recreate cross-posts as needed</li>
      </DocList>
      <DocNote>
        The new course is created with your account as the owner. Add co-instructors from the <strong>Users</strong>
        page after opening the new course.
      </DocNote>

      <DocH2>Entering a Course</DocH2>
      <DocStep number={1}>Click a course card to open the Course Editor.</DocStep>
      <DocStep number={2}>The left sidebar shows navigation options: Course Editor, Assignments, Quizzes, People, Roster.</DocStep>
      <DocStep number={3}>The main area shows the Course Editor — your primary workspace for structuring the course.</DocStep>

      <DocH2>Instructor UI Overview</DocH2>
      <DocList>
        <li><strong>Course Editor</strong> — manage modules, days, assignments, and resources</li>
        <li><strong>Assignments</strong> — view all assignments; access the grading queue</li>
        <li><strong>Quizzes</strong> — create and manage quizzes; view quiz submissions</li>
        <li><strong>Career Development</strong> — manage career dev content separate from the coding curriculum</li>
        <li><strong>Level Up Your Skills</strong> — optional bonus assignments with skill tags</li>
        <li><strong>Grades</strong> — course-wide submission overview and speed grader; a yellow badge shows how many submissions need grading</li>
        <li><strong>Grading Groups</strong> — assign students to specific graders; rotate groups weekly</li>
        <li><strong>Users</strong> — manage student enrollment and roles including TA; add people to the course</li>
        <li><strong>Roster</strong> — accommodation roster with per-student progress and inline grading</li>
        <li><strong>Trash</strong> — recover or permanently delete trashed modules, days, assignments, resources, and quizzes</li>
        <li><strong>Student Preview</strong> — view the course exactly as a student sees it</li>
      </DocList>

      <DocH3>Top Navigation</DocH3>
      <DocP>
        The top navbar shows your name (linking to your account settings), a link to the Attendance Portal, and a logout
        button. On mobile, these collapse into a hamburger menu. Your account settings page lets you update your display
        name and change your password — use the eye icon to show or hide the password field as you type.
      </DocP>

      <DocH2>Your Role</DocH2>
      <DocP>
        Instructors have full access to all courses they&apos;re assigned to. Admins have access to all courses across the
        platform. Your role badge appears next to the AC* logo in the top nav.
      </DocP>
      <DocP>
        <strong>Teaching Assistants (TAs)</strong> are students assigned a TA role for a specific course. TAs see the
        full instructor view but cannot create or edit content — they can grade submissions and view the roster. TAs
        see a blue <strong>TA</strong> badge in the top nav and a dedicated Employment section in the sidebar.
      </DocP>
    </>
  )
}
