import { DocH2, DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'

export default function People() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">People & Enrollment</h1>
      <p className="text-sm text-muted-text mb-8">Add students, manage roles, and control course access.</p>

      <DocH2>The Users Page</DocH2>
      <DocP>
        Navigate to <strong>People</strong> in the course sidebar to open the Users page. It lists every person enrolled
        in the course along with their role (Student, Observer, or Instructor).
      </DocP>

      <DocH2>Adding a Student</DocH2>
      <DocStep number={1}>Click <strong>+ Add Student</strong> on the Users page.</DocStep>
      <DocStep number={2}>Enter the student&apos;s email address.</DocStep>
      <DocStep number={3}>The student is enrolled and will see the course on their My Courses page after logging in.</DocStep>

      <DocTip>
        If you&apos;re adding multiple students, add them one at a time. Each enrollment is processed separately.
      </DocTip>

      <DocH2>Enrollment Roles</DocH2>
      <DocList>
        <li><strong>Student</strong> — full access: can submit assignments, take quizzes, receive grades</li>
        <li><strong>Observer</strong> — read-only access: can view content but cannot submit or take quizzes</li>
        <li><strong>Instructor</strong> — same access as you; can edit the course</li>
      </DocList>

      <DocH3>When to Use Observer</DocH3>
      <DocP>
        Set a student to Observer when they are on leave but need to follow along with course content. Observers can still
        read assignments, view resources, and see published quizzes — but their submission capabilities are disabled.
      </DocP>

      <DocH2>Changing a Student&apos;s Role</DocH2>
      <DocStep number={1}>Find the student in the Users list.</DocStep>
      <DocStep number={2}>Click the role dropdown next to their name.</DocStep>
      <DocStep number={3}>Select the new role. The change takes effect immediately.</DocStep>

      <DocNote>
        Only admins can assign the Admin role. Instructors can assign Student, Observer, and Instructor roles.
      </DocNote>

      <DocH2>Removing a Student</DocH2>
      <DocP>
        Click the <strong>Remove</strong> button next to a student to unenroll them from the course. Their submission
        history is preserved in the database but they will no longer see the course.
      </DocP>

      <DocH2>All Users</DocH2>
      <DocP>
        Admins can navigate to <strong>All Users</strong> to see every user across all courses. This view is useful for
        managing users who are enrolled in multiple courses or for finding a user&apos;s email.
      </DocP>
    </>
  )
}
