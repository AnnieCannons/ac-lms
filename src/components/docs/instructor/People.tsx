import { DocH2, DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'

export default function People() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">People &amp; Enrollment</h1>
      <p className="text-sm text-muted-text mb-8">Add students, manage roles, and control course access.</p>

      <DocH2>The Users Page</DocH2>
      <DocP>
        Navigate to <strong>People</strong> in the course sidebar to open the Users page. It lists everyone enrolled in
        the course along with their role and the option to change it or remove them.
      </DocP>

      <DocH2>Adding a Student</DocH2>
      <DocStep number={1}>Click <strong>+ Add Student</strong> on the Users page.</DocStep>
      <DocStep number={2}>Enter the student&apos;s email address. If they don&apos;t have an LMS account yet, one will be created and they&apos;ll receive an invitation email.</DocStep>
      <DocStep number={3}>The student is enrolled and will see the course on their My Courses page after logging in.</DocStep>

      <DocTip>
        If you&apos;re adding multiple students, add them one at a time. Each enrollment is processed separately.
      </DocTip>

      <DocH2>Enrollment Roles</DocH2>
      <DocList>
        <li><strong>Student</strong> — full access: can submit assignments, take quizzes, and receive grades</li>
        <li><strong>Observer</strong> — read-only access: can view content but cannot submit or take quizzes. Use this for students who are temporarily on leave.</li>
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

      <DocH2>Changing a Student&apos;s Role</DocH2>
      <DocStep number={1}>Find the student in the Users list.</DocStep>
      <DocStep number={2}>Click the role pill next to their name.</DocStep>
      <DocStep number={3}>Select the new role from the dropdown. The change takes effect immediately — no page refresh needed.</DocStep>

      <DocNote>
        Only admins can assign the Admin role. Instructors can assign Student, Observer, TA, and Instructor roles.
      </DocNote>

      <DocH2>Removing a Student</DocH2>
      <DocP>
        Click the <strong>Remove</strong> button next to a student to unenroll them from the course. Their submission
        history and grades are preserved in the database, but they will no longer see the course on their My Courses
        page.
      </DocP>

      <DocH2>All Users (Admins)</DocH2>
      <DocP>
        Admins can navigate to <strong>All Users</strong> to see every user enrolled across all courses. This view is
        useful for finding a user&apos;s email, managing users across multiple courses, or checking enrollment status
        system-wide.
      </DocP>
    </>
  )
}
