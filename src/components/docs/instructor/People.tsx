import { DocH2, DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'

export default function People() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">People &amp; Enrollment</h1>
      <p className="text-sm text-muted-text mb-8">Add students, manage roles, and control course access.</p>

      <DocH2>The Users Page</DocH2>
      <DocP>
        Navigate to <strong>Users</strong> in the course sidebar to manage everyone in the course. The page has two tabs:
      </DocP>
      <DocList>
        <li><strong>Current Class</strong> — everyone enrolled in this specific course, with role controls and the ability to remove members</li>
        <li><strong>All Users</strong> — every user across all courses (admins only)</li>
      </DocList>

      <DocH2>Adding People</DocH2>
      <DocP>
        Click <strong>+ Add People</strong> at the top of the Users page. A modal asks you what type of person you&apos;re adding:
      </DocP>

      <DocH3>Adding Students</DocH3>
      <DocStep number={1}>Choose <strong>Students</strong> in the modal.</DocStep>
      <DocStep number={2}>Select the <strong>course</strong> to enroll them in — it defaults to the current course, but you can change it to any other course you have access to.</DocStep>
      <DocStep number={3}>Paste email addresses — one per line, or comma-separated. You can add as many as you like at once.</DocStep>
      <DocStep number={4}>Click <strong>Add</strong>. Each email is processed immediately and a results list shows whether each person was added or invited.</DocStep>
      <DocTip>
        If an email already has an account in the system, the student is enrolled instantly — no invite email is sent. If
        the email is new, an invitation is sent and they appear in <strong>Pending Invitations</strong> until they accept.
      </DocTip>

      <DocH3>Adding Staff</DocH3>
      <DocP>
        Choose <strong>Staff</strong> in the modal. Staff members are added <strong>globally</strong> — they get access
        to all courses in the system. Paste their email addresses and click Add.
      </DocP>
      <DocP>
        After adding, assign them to a specific course from the <strong>Instructors</strong> table on the Users page —
        or leave them unassigned if they don&apos;t have a dedicated class.
      </DocP>
      <DocNote>
        Staff are added with the global Instructor role. If you only want someone to grade for a single course without
        full instructor access, use the <strong>TA</strong> role instead (see below).
      </DocNote>

      <DocH2>Pending Invitations</DocH2>
      <DocP>
        When a new email is added that doesn&apos;t yet have an account, an invite email is sent and the address appears
        in the <strong>Pending Invitations</strong> section. From there you can:
      </DocP>
      <DocList>
        <li><strong>Resend</strong> — send the invite email again if the student didn&apos;t receive it or it expired</li>
        <li><strong>Revoke</strong> (trash icon) — cancel the invitation before the student accepts</li>
      </DocList>
      <DocTip>
        Once the student logs in and accepts, the invitation disappears and they appear in the Learners list.
      </DocTip>

      <DocH2>Enrollment Roles</DocH2>
      <DocList>
        <li><strong>Student</strong> — full access: can submit assignments, take quizzes, and receive grades</li>
        <li><strong>Observer</strong> — read-only access: can view content and previous work but cannot submit or take quizzes. Use this for students who are temporarily on leave.</li>
        <li><strong>TA</strong> — read-only instructor view with grading rights: can grade submissions and view the roster, but cannot create or edit course content or manage users</li>
        <li><strong>Staff / Instructor</strong> — full instructor access to this course</li>
      </DocList>

      <DocH3>When to Use Observer</DocH3>
      <DocP>
        Set a student to Observer when they need to step back from active participation — for leave, a break, or any
        other reason. Observers keep full access to all course content and their previous work. Their submission and
        quiz capabilities are paused until you restore them to Student status.
      </DocP>
      <DocTip>
        Observer status preserves everything — grades, previous submissions, comments, all progress — exactly as the
        student left it. Nothing is lost.
      </DocTip>

      <DocH3>When to Use TA</DocH3>
      <DocP>
        Assign the TA role to a student who will help grade submissions for this course. TAs see the full instructor
        interface (course editor, assignments, roster, quizzes) but all create, edit, and delete controls are hidden.
        TAs can grade with Complete/Incomplete and leave comments. They also see Benefits and Paid Time Off pages
        in their sidebar.
      </DocP>
      <DocTip>
        After assigning the TA role, go to <strong>Grading Groups</strong> to assign the TA a set of students to grade.
      </DocTip>

      <DocH2>Changing a Role</DocH2>
      <DocStep number={1}>Find the person in the Learners list.</DocStep>
      <DocStep number={2}>Click the role pill next to their name.</DocStep>
      <DocStep number={3}>Select the new role from the dropdown. The change takes effect immediately — no page refresh needed.</DocStep>
      <DocNote>
        Only admins can assign the Admin role. Instructors can assign Student, Observer, TA, and Instructor roles.
      </DocNote>

      <DocH2>Removing Someone from a Course</DocH2>
      <DocP>
        On the <strong>Current Class</strong> tab, click the <strong>trash icon</strong> next to a person to remove
        them from this course only. Their account remains active, and any other course enrollments are unaffected.
        Their submission history and grades for this course are preserved in the database.
      </DocP>
      <DocNote>
        This only removes the enrollment — it does not delete the person&apos;s account. To permanently delete an
        account, use the trash icon on the <strong>All Users</strong> tab (admins only).
      </DocNote>

      <DocH2>All Users Tab</DocH2>
      <DocP>
        Switch to the <strong>All Users</strong> tab to see every student enrolled across all courses in a single
        alphabetical list. Each row shows the student&apos;s name, email, and the course(s) they are enrolled in.
      </DocP>

      <DocH3>Deleting an Account</DocH3>
      <DocP>
        Click the <strong>trash icon</strong> on the All Users tab to permanently delete that person&apos;s account.
        A confirmation dialog appears before anything is deleted. Deleting an account:
      </DocP>
      <DocList>
        <li>Removes the user from all course enrollments</li>
        <li>Deletes their user profile</li>
        <li>Deletes their login credentials — they will not be able to log in</li>
      </DocList>
      <DocNote>
        Account deletion is permanent and cannot be undone. Use <strong>Current Class → trash</strong> if you only
        want to unenroll someone from a single course while keeping their account.
      </DocNote>

      <DocH3>Deleting Staff (Admins Only)</DocH3>
      <DocP>
        Admins can also delete instructor and admin accounts from the Instructors &amp; Admins table on the All Users
        tab. The same confirmation dialog applies. A deleted staff member loses access to all courses immediately.
      </DocP>
    </>
  )
}
