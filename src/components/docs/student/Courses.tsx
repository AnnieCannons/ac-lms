import { DocH2, DocH3, DocP, DocList, DocTip, DocNote } from '@/components/docs/DocComponents'

export default function Courses() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Course Outline</h1>
      <p className="text-sm text-muted-text mb-8">Navigate your course week by week.</p>

      <DocH2>Modules and Weeks</DocH2>
      <DocP>
        Your course is organized into <strong>modules</strong>, each representing one week of content. Modules appear as
        collapsible accordion sections in the Course Outline. The current week is highlighted with a teal badge.
      </DocP>
      <DocTip>
        The current week is automatically highlighted. Look for the &quot;Week X this week&quot; badge at the top of the
        course outline.
      </DocTip>

      <DocH2>Day Cards</DocH2>
      <DocP>
        Inside each module you'll see cards for each day of the week — Monday through Thursday. Each day card shows:
      </DocP>
      <DocList>
        <li>The day name (Monday, Tuesday, etc.)</li>
        <li>Any assignments due that day</li>
        <li>Any quizzes scheduled for that day</li>
        <li>Resources attached to that day</li>
      </DocList>

      <DocH3>Clicking Into a Day</DocH3>
      <DocP>
        Click any day card to open the full day detail page. There you can see all resources, read assignment instructions,
        and access quizzes directly from the day view.
      </DocP>

      <DocH2>Published vs. Unpublished Content</DocH2>
      <DocP>
        Only <strong>published</strong> modules and assignments are visible to students. Your instructor controls what is
        published and when. If you expect to see content that isn't there yet, it may not be published — check with your
        instructor.
      </DocP>
      <DocNote>
        Modules or assignments marked as unpublished are completely hidden from the student view. You won&apos;t see a
        placeholder — they simply won&apos;t appear.
      </DocNote>

      <DocH2>Course Information and Syllabus</DocH2>
      <DocP>
        The <strong>Syllabus</strong> button at the top right of the Course Outline opens the course info page, which
        includes the course description, syllabus document, and other course-level information your instructor has
        provided.
      </DocP>
    </>
  )
}
