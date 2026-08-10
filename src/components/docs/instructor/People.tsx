import { DocAccordion, DocAccordionItem } from '@/components/docs/DocAccordion'
import { DocH3, DocP, DocList, DocOL, DocTip, DocNote, DocStep, DocCode } from '@/components/docs/DocComponents'

const items: DocAccordionItem[] = [
  {
    id: 'users-page',
    title: 'The Users Page',
    content: (
      <>
        <DocP>
          Navigate to <strong>Users</strong> in the course sidebar to manage everyone in the course. (TAs don&apos;t
          see this link — user management is hidden from the TA sidebar entirely.) The page has two tabs:
        </DocP>
        <DocList>
          <li><strong>Current Class</strong> — everyone enrolled in this specific course: Learners, Observers, Staff assigned to teach it, and Pending Invitations</li>
          <li><strong>All Users</strong> — every Instructor and Admin on the platform, plus every student enrolled in any course, grouped by course. Available to any instructor, staff member, or admin — not admin-only. (Real Staff-role accounts don&apos;t currently appear in this table&apos;s Instructors &amp; Admins list — see <strong>The Global Users Page</strong> below, which does include them.)</li>
        </DocList>
        <DocNote>
          There&apos;s also a separate <strong>Roster</strong> page in the sidebar for tracking accommodations —
          that&apos;s a different tool from Users and is covered in its own Help section.
        </DocNote>
      </>
    ),
  },
  {
    id: 'adding-people',
    title: 'Adding People',
    content: (
      <>
        <DocP>
          Click <strong>+ Add People</strong> at the top of the Users page. A modal asks what type of person
          you&apos;re adding — <strong>Students</strong>, <strong>Teaching Assistants</strong>, <strong>Instructor</strong>,
          and <strong>Staff</strong> for everyone, plus <strong>Admin</strong> if you&apos;re an admin.
        </DocP>

        <DocH3>Adding Students or Teaching Assistants</DocH3>
        <DocP>
          Both are course-scoped. Teaching Assistants are described in the modal as: &ldquo;Former students
          returning to help for a term — course-scoped access.&rdquo;
        </DocP>
        <DocStep number={1}>Choose <strong>Students</strong> or <strong>Teaching Assistants</strong> in the modal.</DocStep>
        <DocStep number={2}>Pick the <strong>Course</strong> — it defaults to the current course, but you can change it to any other course.</DocStep>
        <DocStep number={3}>Paste email addresses into the box — one per line, or comma-separated.</DocStep>
        <DocStep number={4}>Click <strong>Add</strong> (the button reads <DocCode>Add N people</DocCode> once you&apos;ve pasted more than one email). A results list shows a checkmark and &ldquo;Added&rdquo; or &ldquo;Invite sent&rdquo; for each address, or an error such as &ldquo;Already enrolled.&rdquo;</DocStep>
        <DocTip>
          If an email already has an account, the person is enrolled instantly — no invite email is sent. If the
          email is new, an invite is sent and it appears under <strong>Pending Invitations</strong> until accepted.
        </DocTip>

        <DocH3>Adding an Instructor, Staff, or Admin</DocH3>
        <DocP>
          Choose <strong>Instructor</strong> (&ldquo;Course instructors — added globally, with access to all
          courses&rdquo;), <strong>Staff</strong> (&ldquo;Operations and partnerships staff — added globally, with
          access to all courses&rdquo;), or, if you&apos;re an admin, <strong>Admin</strong> (&ldquo;Full
          administrative access&rdquo;). There&apos;s no course picker for these — the modal shows a
          &ldquo;Global access&rdquo; note instead:
        </DocP>
        <DocTip>
          &ldquo;Staff members can see all courses. After adding, you can assign them to a specific course from the
          Staff table on this page — or leave them unassigned if they don&apos;t have a dedicated class.&rdquo;
        </DocTip>
        <DocP>
          Paste email addresses and click <strong>Add</strong>, same as above. The <strong>Staff</strong> table
          referenced in that note is on the Current Class tab — see <strong>Changing a Role</strong> below for how
          to assign them to teach a course from there.
        </DocP>
        <DocNote>
          You can also pre-select instructors when creating or duplicating a course, using the{' '}
          <strong>Assign Instructors</strong> picker on the New Course page.
        </DocNote>
      </>
    ),
  },
  {
    id: 'pending-invitations',
    title: 'Pending Invitations',
    content: (
      <>
        <DocP>
          When a new email doesn&apos;t yet have an account, an invite is sent and the address appears under{' '}
          <strong>Pending Invitations</strong> on the Current Class tab. From there:
        </DocP>
        <DocList>
          <li><strong>Resend</strong> — send the invite email again</li>
          <li><strong>Trash icon</strong> — revoke the invitation immediately (any instructor, staff, or admin can do this — there&apos;s no confirmation step)</li>
        </DocList>
        <DocTip>
          Once the person logs in and accepts, the invitation disappears from this list and they show up as a
          Learner (or in the Staff table, for global roles).
        </DocTip>
        <DocNote>
          The main <strong>Users</strong> page (<DocCode>/instructor/users</DocCode>) has its own{' '}
          <strong>Pending Invites</strong> table covering invitations across every course, with a Course column
          (shown as &ldquo;Global&rdquo; for Instructor/Staff/Admin invites). On that table, <strong>Revoke</strong>{' '}
          is admin-only — Resend is not.
        </DocNote>
      </>
    ),
  },
  {
    id: 'roles',
    title: 'Enrollment Roles',
    content: (
      <>
        <DocP>Course-level roles, stored per enrollment:</DocP>
        <DocList>
          <li><strong>Student</strong> — full access: can submit assignments, take quizzes, and receive grades</li>
          <li><strong>Observer</strong> — read-only access: can view content and previous work but cannot submit or take quizzes. Use this for students who are temporarily on leave.</li>
          <li><strong>TA</strong> — read-only instructor view with grading rights: can grade submissions and view the roster, but cannot create or edit course content or manage users</li>
        </DocList>
        <DocP>Global roles, stored on the person&apos;s account and applying across every course:</DocP>
        <DocList>
          <li><strong>Instructor</strong> — full course management: can create, edit, grade, and manage enrollments for any course they&apos;re assigned to</li>
          <li><strong>Staff</strong> — same course access as Instructor plus access to the Partnerships dashboard; for coordinators and program staff</li>
          <li><strong>Admin</strong> — full platform access: all courses, all users, and all admin-only actions</li>
        </DocList>

        <DocH3>When to Use Observer</DocH3>
        <DocP>
          Set a student to Observer when they need to step back from active participation — for leave, a break, or
          any other reason. Observers keep full access to all course content and their previous work. Their
          submission and quiz capabilities are paused until you restore them to Student status.
        </DocP>
        <DocTip>
          Observer status preserves everything — grades, previous submissions, comments, all progress — exactly as
          the student left it. Nothing is lost.
        </DocTip>

        <DocH3>When to Use TA</DocH3>
        <DocP>
          Assign the TA role to someone who will help grade submissions for this course only. TAs see the instructor
          interface (course editor, assignments, roster, quizzes) but every create/edit/delete control is hidden,
          and the Users and Grading Groups links don&apos;t appear in their sidebar. TAs can grade with
          Complete/Incomplete and leave comments. They also see Benefits and Paid Time Off pages, under an
          &ldquo;Employment&rdquo; section in their sidebar.
        </DocP>
        <DocTip>
          After assigning the TA role, go to <strong>Grading Groups</strong> to assign the TA a set of students to
          grade.
        </DocTip>

        <DocNote>
          The Learners role dropdown (see <strong>Changing a Role</strong> below) also lets you pick
          &ldquo;Staff&rdquo; or &ldquo;Admin&rdquo; for someone enrolled in this course. That only changes their
          enrollment role for this one course — it does <strong>not</strong> grant them an actual global
          Instructor/Staff/Admin account, and by itself gives them no extra access anywhere. To give someone real
          global access, add them as Instructor/Staff/Admin from <strong>+ Add People</strong> — the Instructors
          &amp; Admins table on the All Users tab only lists people who already have a global role, so it can&apos;t
          be used to promote a plain student.
        </DocNote>
      </>
    ),
  },
  {
    id: 'changing-a-role',
    title: 'Changing a Role',
    content: (
      <>
        <DocStep number={1}>Find the person in the Learners list on the Current Class tab.</DocStep>
        <DocStep number={2}>Click the role pill next to their name.</DocStep>
        <DocStep number={3}>Select the new role from the dropdown: <DocCode>Student</DocCode>, <DocCode>TA</DocCode>, <DocCode>Observer</DocCode>, <DocCode>Staff</DocCode>, or (admins only) <DocCode>Admin</DocCode>. The change takes effect immediately — no page refresh needed.</DocStep>
        <DocNote>
          Only admins can assign the Admin role. Instructors, staff, and admins can all assign Student, Observer,
          TA, and Staff. Remember that Staff/Admin picked here only affects this course&apos;s enrollment — see the
          note in Enrollment Roles above.
        </DocNote>
      </>
    ),
  },
  {
    id: 'removing-and-deleting',
    title: 'Removing and Deleting People',
    content: (
      <>
        <DocH3>Removing a Learner from This Course</DocH3>
        <DocP>
          On the <strong>Current Class</strong> tab, click the <strong>trash icon</strong> next to a Learner. A
          confirmation dialog appears — &ldquo;Remove [name]?&rdquo; — explaining this removes them from this course
          only, with their account and other enrollments untouched. Confirm with <strong>Yes, remove from
          course</strong>. Their submission history and grades for this course are preserved in the database.
        </DocP>

        <DocH3>Staff on the Current Class Tab</DocH3>
        <DocNote>
          The trash icon next to a name in the <strong>Staff</strong> table (visible to admins only) is different
          from the Learner trash icon above: it <strong>permanently deletes that person&apos;s entire account</strong>{' '}
          — immediately, with no confirmation dialog. If you only want to stop someone from teaching this specific
          course, click the <strong>×</strong> on their course pill instead (or use the <strong>+ course</strong>{' '}
          control to assign them to a different one). Only reach for the trash icon here if you mean to delete the
          account outright.
        </DocNote>

        <DocH3>Deleting a Student Account</DocH3>
        <DocP>
          On the <strong>All Users</strong> tab, click the <strong>trash icon</strong> next to a student. A dialog
          asks you to <strong>type their name to confirm</strong> before the <strong>Delete account</strong> button
          becomes enabled. Unlike the Staff table trash icon, this one is <strong>not</strong> admin-only — any
          instructor or staff member can delete a student&apos;s account this way. Deleting an account:
        </DocP>
        <DocList>
          <li>Removes the user from all course enrollments</li>
          <li>Deletes their user profile</li>
          <li>Deletes their login credentials — they will not be able to log in</li>
        </DocList>
        <DocNote>
          Account deletion is permanent and cannot be undone. Use the Learner trash icon on{' '}
          <strong>Current Class</strong> if you only want to unenroll someone from a single course while keeping
          their account.
        </DocNote>

        <DocH3>Deleting an Instructor, Staff, or Admin Account</DocH3>
        <DocP>
          The trash icon next to an entry in the <strong>Instructors &amp; Admins</strong> table on the All Users
          tab is <strong>admin-only</strong> — instructors and staff won&apos;t see it at all. It uses the same
          typed-name confirmation as student deletion, and is permanent and irreversible.
        </DocP>
      </>
    ),
  },
  {
    id: 'global-users-page',
    title: 'The Global Users Page',
    content: (
      <>
        <DocP>
          The <strong>Users</strong> card on the main instructor dashboard (at <DocCode>/instructor/users</DocCode>)
          gives a bird&apos;s-eye view of everyone in the system — available to all instructors, staff, and admins:
        </DocP>
        <DocOL>
          <li><strong>Instructors &amp; Admins</strong> — every global Instructor, Staff, and Admin, with name, email, and role. Admins can edit roles and delete accounts here (with typed-name confirmation).</li>
          <li><strong>Pending Invites</strong> — shown only when invitations are outstanding, across every course.</li>
          <li><strong>Students grouped by course</strong> — students under each currently active course (course start date through 105 days later); students not enrolled in a current course appear under &ldquo;Not enrolled in a current course.&rdquo;</li>
          <li><strong>Past Students</strong> — a placeholder section, currently &ldquo;Coming soon.&rdquo;</li>
        </DocOL>
        <DocP>
          The <strong>+ Add People</strong> button on this page works the same way as from within a course.
        </DocP>
      </>
    ),
  },
]

export default function People() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">People &amp; Enrollment</h1>
      <p className="text-sm text-muted-text mb-8">Add students, manage roles, and control course access.</p>

      <DocAccordion items={items} />
    </>
  )
}
