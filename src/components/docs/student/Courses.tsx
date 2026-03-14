import { DocH2, DocH3, DocP, DocList, DocTip, DocNote } from '@/components/docs/DocComponents'

export default function Courses() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Course Outline</h1>
      <p className="text-sm text-muted-text mb-8">Navigate your course week by week.</p>

      <DocH2>Your Courses List</DocH2>
      <DocP>
        After logging in you see <strong>My Courses</strong> — all courses you are enrolled in. A green{' '}
        <strong>Current</strong> badge appears next to courses that are actively running right now. Current courses
        appear at the top of the list.
      </DocP>
      <DocP>
        If you are a <strong>Teaching Assistant (TA)</strong> for a course, you will see a blue <strong>TA</strong>{' '}
        badge and two links: <em>Instructor View</em> to grade and manage the course, and <em>Student View</em> to
        see it as a student would.
      </DocP>

      <DocH2>Modules and Weeks</DocH2>
      <DocP>
        Your course is organized into <strong>modules</strong>, each representing one week of content. Modules appear as
        collapsible accordion sections in the Course Outline. Click a module header to expand or collapse it.
      </DocP>
      <DocTip>
        The current week is automatically highlighted with a teal &ldquo;Current Week&rdquo; badge. You can always find
        where you are in the course at a glance.
      </DocTip>

      <DocH2>Day Cards</DocH2>
      <DocP>
        Inside each module you&apos;ll see cards for each day of the week. Each day card shows:
      </DocP>
      <DocList>
        <li>The day name (Monday, Tuesday, Wednesday, Thursday)</li>
        <li>Any assignments scheduled for that day</li>
        <li>Any quizzes scheduled for that day</li>
        <li>Resources attached to that day</li>
      </DocList>

      <DocH3>Clicking Into a Day</DocH3>
      <DocP>
        Click any day card to open the full day detail page. There you can read assignment instructions, access resources,
        and open quizzes directly from the day view.
      </DocP>

      <DocH2>Published vs. Unpublished Content</DocH2>
      <DocP>
        Only <strong>published</strong> modules and assignments are visible to students. Your instructor controls what
        is published and when. If you expect to see content that isn&apos;t there yet, it likely hasn&apos;t been
        published — check with your instructor.
      </DocP>
      <DocNote>
        Unpublished modules and assignments are completely hidden. You won&apos;t see a placeholder — they simply
        won&apos;t appear until your instructor publishes them.
      </DocNote>

      <DocH2>Career Dev Content</DocH2>
      <DocP>
        Some assignments, resources, and quizzes are tagged with a purple <strong>Career Dev</strong> badge. These
        items are part of your career development curriculum — things like resume workshops, portfolio prep, or
        job-search resources. Your instructor has placed them on your day cards so you don&apos;t miss them.
        They work exactly like any other assignment or resource; the badge is just a label.
      </DocP>
      <DocP>
        Career Dev content also has its own dedicated <strong>Career Development</strong> section in the sidebar where
        all career-related work is organized in one place.
      </DocP>

      <DocH2>Course Information and Syllabus</DocH2>
      <DocP>
        Click <strong>General Info</strong> in the sidebar to open the course info page, which includes the course
        description, syllabus document, and any other course-level information your instructor has shared. You can
        also reach this from the <strong>Syllabus</strong> button at the top right of the Course Outline.
      </DocP>
    </>
  )
}
