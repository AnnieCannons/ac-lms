import { DocH2, DocH3, DocP, DocList, DocTip, DocStep } from '@/components/docs/DocComponents'

export default function GettingStarted() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Getting Started</h1>
      <p className="text-sm text-muted-text mb-8">An overview of the instructor experience in AC-LMS.</p>

      <DocH2>Instructor Dashboard</DocH2>
      <DocP>
        After logging in you land on the <strong>Courses</strong> page, which lists every course you have access to. Each
        card shows the course name, code, and enrollment dates.
      </DocP>
      <DocTip>
        You can duplicate any course using the options menu on the course card — useful for reusing a course structure
        each cohort.
      </DocTip>

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
        <li><strong>People</strong> — manage student enrollment and roles</li>
        <li><strong>Roster</strong> — accommodation roster with per-student progress and inline grading</li>
        <li><strong>Student Preview</strong> — view the course exactly as a student sees it</li>
      </DocList>

      <DocH3>Top Navigation</DocH3>
      <DocP>
        The top navbar shows your name (linking to your account settings), a link to the Attendance Portal, and a logout
        button. On mobile, these collapse into a hamburger menu.
      </DocP>

      <DocH2>Your Role</DocH2>
      <DocP>
        Instructors have full access to all courses they&apos;re assigned to. Admins have access to all courses across the
        platform. Your role badge appears next to the AC* logo in the top nav.
      </DocP>
    </>
  )
}
