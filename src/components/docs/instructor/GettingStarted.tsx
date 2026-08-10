import { DocH3, DocP, DocList, DocOL, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'
import { DocAccordion, DocAccordionItem } from '@/components/docs/DocAccordion'

export default function GettingStarted() {
  const items: DocAccordionItem[] = [
    {
      id: 'courses-dashboard',
      title: 'Courses Dashboard',
      content: (
        <>
          <DocP>
            After logging in you land on the <strong>Courses</strong> page, which lists every course on the platform —
            instructors, staff, and admins all see the full list, not just courses they created. Courses that are
            currently running show a green <strong>Current</strong> badge, based on the start date plus either the
            course&apos;s actual end date or, if none is set, a 105-day (15-week) window.
          </DocP>
          <DocP>Each course card gives you:</DocP>
          <DocList>
            <li>Click <strong>Manage →</strong> to open a course</li>
            <li>Click <strong>Edit Dates</strong> to update its start/end dates and Airtable course name</li>
            <li>Click <strong>Duplicate</strong> to copy a course with optional due-date shifting</li>
            <li>Click the <strong>trash icon</strong> to permanently delete the course</li>
            <li><strong>Add to Past Classes →</strong> appears once the course&apos;s end date has passed</li>
          </DocList>
          <DocNote>
            The trash icon deletes a course immediately after a confirmation dialog — it permanently removes all of
            its modules, days, and assignments. There is no trash/recovery step for a deleted course the way there is
            for modules, days, and assignments inside a course.
          </DocNote>

          <DocH3>Creating a New Course</DocH3>
          <DocP>Click <strong>+ New Course</strong> at the top of the Courses page to open the new course form.</DocP>
          <DocStep number={1}>Enter a <strong>Course Name</strong> and <strong>Course Code</strong>.</DocStep>
          <DocStep number={2}>Set a <strong>Start Date</strong> and <strong>End Date</strong> (optional).</DocStep>
          <DocStep number={3}>Optionally fill in a <strong>Syllabus</strong> overview.</DocStep>
          <DocStep number={4}>Under <strong>Assign Instructors</strong>, search and check any other instructors or staff who should have access — you&apos;re enrolled automatically either way.</DocStep>
          <DocStep number={5}>Check <strong>Paid learners</strong> under Course Type if this cohort should see Benefits &amp; PTO in their sidebar.</DocStep>
          <DocStep number={6}>Click <strong>Create Course</strong>. You&apos;re taken straight to the new course.</DocStep>

          <DocH3>Editing Course Dates</DocH3>
          <DocP>Click <strong>Edit Dates</strong> on any course card to open the Edit Course Dates modal.</DocP>
          <DocOL>
            <li>Update the <strong>Start Date</strong> and/or <strong>End Date</strong>.</li>
            <li>
              Update the <strong>Airtable Course Name</strong> field if needed. If the current value follows the
              &quot;Jan/May/Sept YYYY - [track]&quot; pattern, a <strong>Next cohort</strong> suggestion button offers
              the next term&apos;s name (e.g. <em>May 2026 - Advanced Frontend</em> → <em>Sept 2026 - Advanced
              Frontend</em>) — click it to fill the field automatically.
            </li>
            <li>Click <strong>Save</strong>.</li>
          </DocOL>
          <DocNote>
            The Airtable Course Name is used to scope attendance lookups — keep it matching your Airtable record
            exactly. Editing it manually shows a warning reminding you of this.
          </DocNote>

          <DocH3>Archiving Courses (Past Classes)</DocH3>
          <DocP>
            Once a course&apos;s end date has passed, its card shows <strong>Add to Past Classes →</strong> instead of
            being removed automatically. Clicking it (after a confirmation prompt) moves the course into the
            collapsed <strong>Past Classes</strong> section at the bottom of the Courses page.
          </DocP>
          <DocList>
            <li>Click <strong>Past Classes (N)</strong> to expand or collapse the archived list</li>
            <li>Each archived course keeps its <strong>Manage →</strong> link</li>
            <li>Click <strong>Restore</strong> on an archived course to move it back to the active list</li>
          </DocList>
        </>
      ),
    },
    {
      id: 'duplicating-a-course',
      title: 'Duplicating a Course',
      content: (
        <>
          <DocP>
            Clicking <strong>Duplicate</strong> on any course opens a modal where you can configure the copy before it
            is created. Only admins can duplicate any course; instructors and staff can duplicate courses they&apos;re
            enrolled in.
          </DocP>
          <DocList>
            <li><strong>Course Name</strong> — pre-filled as &ldquo;Copy of [original name]&rdquo;; edit as needed</li>
            <li><strong>Course Code</strong> — pre-filled by incrementing the original code&apos;s suffix (e.g. <em>BE-2026</em> → <em>BE-2027</em>); must be unique</li>
          </DocList>

          <DocH3>Date Shifting</DocH3>
          <DocP>
            If you enter both an <strong>Original Start Date</strong> and a <strong>New Start Date</strong>, every
            assignment due date, quiz due date, and the course&apos;s own end date are all shifted by the difference
            between the two. Leave both blank to keep the original dates unchanged.
          </DocP>
          <DocStep number={1}>Enter the date the original course started (or confirm the pre-filled value) in <strong>Original Start Date</strong>.</DocStep>
          <DocStep number={2}>Enter the start date for the new cohort in <strong>New Start Date</strong>.</DocStep>
          <DocStep number={3}>Click <strong>Duplicate Course →</strong>. The new course opens automatically after a few seconds.</DocStep>
          <DocTip>
            Date shifting is purely arithmetic — it moves every date by the same number of days as the difference
            between the two start dates. Review due dates after duplicating to catch any assignments that may land on
            holidays or weekends.
          </DocTip>

          <DocH3>What Gets Copied</DocH3>
          <DocList>
            <li>All modules, days, and their structure</li>
            <li>All assignments (including instructions, checklist items, and publish status)</li>
            <li>All resources attached to days, including instructor-only resources</li>
            <li>All quizzes (questions, settings, and publish status)</li>
            <li>Course sections (syllabus, info pages)</li>
          </DocList>
          <DocNote>
            Module publish status is <strong>not</strong> copied — every duplicated module is published in the new
            course, even if it was unpublished in the source course. Review and re-hide any draft modules after
            duplicating.
          </DocNote>

          <DocH3>Assigning Instructors</DocH3>
          <DocP>
            The duplicate modal includes an <strong>Assign Instructors</strong> list, the same as the new-course form.
            You&apos;re checked by default; check or uncheck any other instructors or staff who should also be
            enrolled — they&apos;re added when the course is created.
          </DocP>

          <DocH3>What Does Not Get Copied</DocH3>
          <DocList>
            <li><strong>Student enrollments</strong> — the new course starts empty; add students separately</li>
            <li><strong>Submissions and grades</strong> — no student data is carried over</li>
            <li><strong>Grading groups</strong> — reset for the new cohort</li>
            <li><strong>Career Dev cross-posts</strong> — career dev content exists only in the source course; recreate cross-posts as needed</li>
          </DocList>
          <DocNote>
            Instructor access isn&apos;t scoped by enrollment — every instructor, staff member, and admin can already
            open any course from the Courses page. Assign Instructors just pre-enrolls the people you pick (useful for
            grading-group assignment); you and anyone else can add more instructors later from the course&apos;s{' '}
            <strong>Users</strong> page regardless.
          </DocNote>
        </>
      ),
    },
    {
      id: 'course-navigation',
      title: 'Finding Your Way Around a Course',
      content: (
        <>
          <DocP>
            Click a course card&apos;s <strong>Manage →</strong> link (or the course name) to open it. The course name
            in the breadcrumb at top and the course name at the top of the left sidebar both confirm which course
            you&apos;re in.
          </DocP>
          <DocTip>
            If you have more than one course currently running, click the course name at the top of the sidebar to
            open a dropdown and jump straight to another current course.
          </DocTip>

          <DocH3>Top-Level Links</DocH3>
          <DocList>
            <li><strong>General Info</strong> — course description, schedule, policies, and contact info pages</li>
            <li><strong>Users</strong> — manage enrollment and roles (hidden for TAs)</li>
            <li><strong>Roster</strong> — accommodation roster with per-student progress and inline grading</li>
          </DocList>

          <DocH3>Course Section</DocH3>
          <DocP>Under the <strong>Course</strong> heading:</DocP>
          <DocList>
            <li><strong>All Modules</strong> — the Course Editor; your main workspace for structuring modules, days, assignments, and resources</li>
            <li><strong>Course Outline</strong> — the full syllabus-style schedule view of the course</li>
            <li><strong>Assignments</strong> — every assignment in the course in one list</li>
            <li><strong>Quizzes</strong> — create and manage quizzes</li>
            <li><strong>Class Resources</strong> — all student-visible resources across the course</li>
            <li><strong>Instructor Resources</strong> — resources marked instructor-only</li>
            <li><strong>Career Development</strong> — career dev content, kept separate from the coding curriculum</li>
            <li><strong>Level Up Your Skills</strong> — optional bonus assignments with skill tags</li>
          </DocList>
          <DocP>Use the <strong>+ Create</strong> button above this section to add a module, day, assignment, resource, or quiz without leaving the sidebar (hidden for TAs).</DocP>

          <DocH3>Grades Section</DocH3>
          <DocList>
            <li><strong>Grades</strong> — course-wide submission overview and speed grader; a yellow badge shows how many submissions need grading</li>
            <li><strong>Gradebook</strong> — full spreadsheet of every student&apos;s status on every published assignment</li>
            <li><strong>Quiz Submissions</strong> — table of student quiz attempts and scores</li>
            <li><strong>Confidence Tracker</strong> — students&apos; self-reported confidence check-ins</li>
            <li><strong>Launch Grader →</strong> — opens a modal to jump straight into grading: By Student, By Assignment, Grade All Ungraded, or Grade for My Group</li>
            <li><strong>Grading Groups</strong> — assign students to specific graders; rotate groups weekly (hidden for TAs)</li>
            <li><strong>Extension Requests</strong> — review students&apos; due-date extension requests, with a badge for pending requests</li>
          </DocList>

          <DocH3>Trash and Other Tools</DocH3>
          <DocList>
            <li><strong>🗑 Trash</strong> — recover or permanently delete trashed modules, days, assignments, resources, and quizzes (hidden for TAs)</li>
            <li><strong>Global Templates</strong> — shared pages that apply across every course: Policies and Procedures, Computer and Wifi, Calendar, Paid Time Off, Benefits, plus any custom Everyday Resources pages (hidden for TAs)</li>
            <li><strong>Student View</strong> — view the course exactly as a student sees it; the button becomes <strong>Leave Student View</strong> while active</li>
            <li><strong>🚀 Launch setup</strong> — fill in cohort-specific links (Zoom, Slack, recordings, office hours) that sync into the course&apos;s Everyday Resources page (hidden for TAs)</li>
          </DocList>
        </>
      ),
    },
    {
      id: 'global-dashboard-pages',
      title: 'Global Dashboard Pages',
      content: (
        <>
          <DocP>From the main instructor dashboard (outside any course), two additional pages are available:</DocP>
          <DocList>
            <li><strong>Users</strong> — a global directory of all students grouped by active course, plus all staff and admins. Available to all instructors, staff, and admins.</li>
            <li><strong>Partnerships</strong> — manage external organizations: partner records, contacts, types, tags, and status. Visible to staff and admins only.</li>
          </DocList>
        </>
      ),
    },
    {
      id: 'top-nav-account',
      title: 'Top Navigation, Account & Passwords',
      content: (
        <>
          <DocP>The top navbar shows:</DocP>
          <DocList>
            <li>The <strong>AC*</strong> logo, linking to your courses list, with your role badge next to it</li>
            <li>A breadcrumb trail (e.g. Courses › [course name]) when you&apos;re inside a course</li>
            <li>A link to the <strong>Attendance Portal</strong></li>
            <li>A <strong>Help</strong> link that opens this documentation</li>
            <li>Your name, linking to your account settings</li>
            <li>A logout button</li>
          </DocList>
          <DocP>
            On mobile, the right-hand items collapse into a hamburger menu with Confidence Tracker, Attendance Portal,
            your account link, and logout (the Help link is desktop-only).
          </DocP>
          <DocP>Your account settings page (click your name) has three sections:</DocP>
          <DocList>
            <li><strong>Name</strong> — update your display name</li>
            <li><strong>Email Address</strong> — update your login email</li>
            <li><strong>Change Password</strong> — enter your current password, then a new one twice; use the eye icon on any password field to show or hide what you&apos;ve typed</li>
          </DocList>

          <DocH3>Password Requirements</DocH3>
          <DocP>All passwords — for new accounts and password changes — must meet these requirements:</DocP>
          <DocList>
            <li>At least <strong>8 characters</strong> long</li>
            <li>At least one <strong>uppercase</strong> letter (A–Z)</li>
            <li>At least one <strong>lowercase</strong> letter (a–z)</li>
            <li>At least one <strong>number</strong> (0–9)</li>
            <li>At least one <strong>symbol</strong> (e.g. !, @, #, $)</li>
          </DocList>
          <DocNote>
            Invite links sent to new users expire. If a student or TA doesn&apos;t accept in time, resend the invite
            from the Users page.
          </DocNote>
        </>
      ),
    },
    {
      id: 'your-role',
      title: 'Your Role & Access Levels',
      content: (
        <>
          <DocP>
            Instructors have full access to all courses on the platform, not just ones they created or were enrolled
            in — access isn&apos;t scoped per course. Staff have the same access as instructors, plus the Partnerships
            dashboard. Admins have that same full access plus admin-only actions like assigning the Admin role or
            deleting other staff accounts. Your role badge appears next to the AC* logo in the top nav.
          </DocP>
          <DocP>
            <strong>Teaching Assistants (TAs)</strong> are students assigned a TA role for one specific course. TAs see
            the full instructor view for that course but every create/edit/delete control is hidden — Users,
            Grading Groups, Trash, Global Templates, and Launch setup all disappear from the sidebar, and the Course
            Editor is read-only. TAs can still grade submissions and view the Roster. TAs see a &quot;TA&quot; badge in
            the top nav (same style as the role badge) and a dedicated <strong>Employment</strong> section in the
            sidebar with <strong>Benefits</strong> and <strong>Paid Time Off</strong> links.
          </DocP>
        </>
      ),
    },
  ]

  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Getting Started</h1>
      <p className="text-sm text-muted-text mb-8">An overview of the instructor experience in AC-LMS.</p>

      <DocAccordion items={items} />
    </>
  )
}
