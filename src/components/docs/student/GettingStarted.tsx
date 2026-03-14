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
        Use the <strong>show/hide password</strong> eye icon on the login page to reveal your password as you type — useful
        if you want to double-check what you&apos;ve entered. Bookmark the login page so you can return quickly. If you
        forget your password, contact your instructor or admin.
      </DocTip>

      <DocH2>Your Course List</DocH2>
      <DocP>
        After logging in you land on <strong>My Courses</strong>. Every course you&apos;re enrolled in appears as a card showing
        the course name, code, and date range. Courses that are currently running show a green <strong>Current</strong> badge
        and appear at the top.
      </DocP>
      <DocStep number={1}>Click any course card to open that course.</DocStep>
      <DocStep number={2}>You&apos;ll see the Course Outline — modules organized by week.</DocStep>
      <DocStep number={3}>Use the left sidebar to navigate between sections of the course.</DocStep>

      <DocH2>Sidebar Navigation</DocH2>
      <DocP>Inside a course the left sidebar gives you quick access to every section. Not all sections appear in every course — your instructor controls what is available.</DocP>

      <DocH3>General</DocH3>
      <DocList>
        <li><strong>General Info</strong> — course description, syllabus, and any course-level information your instructor has shared</li>
      </DocList>

      <DocH3>Course</DocH3>
      <DocList>
        <li><strong>Course Outline</strong> — all weeks and days; the main view of your course content</li>
        <li><strong>Assignments</strong> — every assignment in the course with its current status (not started, turned in, complete, etc.)</li>
        <li><strong>Quizzes</strong> — published quizzes and your scores</li>
        <li><strong>Class Resources</strong> — videos, readings, links, and files your instructor has attached to the course</li>
        <li><strong>Career Development</strong> — career dev assignments, resources, and quizzes (when your program includes career content)</li>
        <li><strong>Level Up Your Skills</strong> — optional bonus assignments you can do for extra practice (when available)</li>
      </DocList>

      <DocH3>Employment (paid learners)</DocH3>
      <DocList>
        <li><strong>Benefits</strong> — information about your employment benefits</li>
        <li><strong>Paid Time Off</strong> — PTO tracking and policies</li>
      </DocList>

      <DocH2>Your Profile &amp; Account Settings</DocH2>
      <DocP>
        Click your name in the top navigation bar to access your account settings. From there you can:
      </DocP>
      <DocList>
        <li>Update your display name</li>
        <li>Change your password — use the <strong>eye icon</strong> to show or hide what you&apos;re typing</li>
        <li>Adjust <strong>Accessibility</strong> settings: dark mode, high contrast, and dyslexia-friendly font</li>
      </DocList>

      <DocH3>Attendance Portal</DocH3>
      <DocP>
        The <strong>Attendance Portal</strong> link in the top nav opens a separate app for recording daily attendance. It
        opens in a new tab and is separate from this LMS.
      </DocP>
    </>
  )
}
