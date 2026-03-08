import { DocH2, DocH3, DocP, DocList, DocTip, DocStep } from '@/components/docs/DocComponents'

export default function GettingStarted() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Getting Started</h1>
      <p className="text-sm text-muted-text mb-8">Welcome to AC-LMS — your online learning platform.</p>

      <DocH2>Logging In</DocH2>
      <DocP>
        Navigate to your LMS URL and enter your email and password on the login page. Your instructor or program coordinator
        will have provided your credentials when you enrolled.
      </DocP>
      <DocTip>
        Bookmark the login page so you can return quickly. If you forget your password, contact your instructor or admin.
      </DocTip>

      <DocH2>Your Course List</DocH2>
      <DocP>
        After logging in you land on <strong>My Courses</strong>. Every course you're enrolled in appears as a card showing
        the course name, code, and date range.
      </DocP>
      <DocStep number={1}>Click any course card to open that course.</DocStep>
      <DocStep number={2}>You'll see the Course Outline — modules organized by week.</DocStep>
      <DocStep number={3}>Use the left sidebar to navigate between sections of the course.</DocStep>

      <DocH2>Sidebar Navigation</DocH2>
      <DocP>Inside a course the left sidebar gives you quick access to every section:</DocP>
      <DocList>
        <li><strong>Course Outline</strong> — weekly modules and day cards</li>
        <li><strong>Assignments</strong> — all assignments with status badges</li>
        <li><strong>Quizzes</strong> — published quizzes and your scores</li>
        <li><strong>Info</strong> — course description and syllabus</li>
        <li><strong>Resources</strong> (when available) — videos, readings, and links</li>
      </DocList>

      <DocH2>Your Profile</DocH2>
      <DocP>
        Click your name in the top navigation bar to access your account settings. You can update your display name and
        other profile information there.
      </DocP>

      <DocH3>Attendance Portal</DocH3>
      <DocP>
        The <strong>Attendance Portal</strong> link in the top nav opens a separate app for recording daily attendance. It
        opens in a new tab and is separate from this LMS.
      </DocP>
    </>
  )
}
