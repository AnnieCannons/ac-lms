import { DocH2, DocH3, DocP, DocList, DocTip, DocNote } from '@/components/docs/DocComponents'

export default function StudentPreview() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Student Preview</h1>
      <p className="text-sm text-muted-text mb-8">See your course exactly as students see it.</p>

      <DocH2>What Is Student Preview?</DocH2>
      <DocP>
        Student Preview lets instructors view a course through a student&apos;s lens — seeing only published content,
        the student sidebar, and the student-facing layout — without actually logging in as a student.
      </DocP>

      <DocH2>How to Enter Preview</DocH2>
      <DocList>
        <li>Open a course in the Course Editor.</li>
        <li>Click the <strong>Student View</strong> button in the top area of the editor.</li>
        <li>You&apos;ll be redirected to the student-facing course page with a preview banner at the top.</li>
      </DocList>

      <DocTip>
        Use Student Preview before publishing new content to verify everything looks correct from the student&apos;s
        perspective.
      </DocTip>

      <DocH2>The Preview Banner</DocH2>
      <DocP>
        A teal banner at the top of the page indicates you are in Student Preview mode. It shows the course name and
        a button to <strong>Exit Preview</strong>.
      </DocP>

      <DocH2>What You Can Do in Preview</DocH2>
      <DocList>
        <li>Navigate the student-facing course outline</li>
        <li>View published modules, day cards, and assignments</li>
        <li>See published quizzes as students see them</li>
        <li>Check resource display and ordering</li>
      </DocList>

      <DocH2>What You Cannot Do in Preview</DocH2>
      <DocList>
        <li>Submit assignments (submissions are disabled for instructors in preview)</li>
        <li>Take quizzes</li>
        <li>Affect any student data</li>
      </DocList>

      <DocNote>
        Student Preview is strictly read-only for instructors. No submissions or quiz responses are recorded, even if the
        form appears active.
      </DocNote>

      <DocH2>How to Exit Preview</DocH2>
      <DocP>
        Click <strong>Exit Preview</strong> in the banner at the top of the page. You&apos;ll be returned to the
        instructor Course Editor view.
      </DocP>

      <DocH3>Preview Session</DocH3>
      <DocP>
        Preview mode is stored as a session cookie scoped to the specific course. If you open another browser tab, you
        remain in preview mode for that course until you explicitly exit.
      </DocP>
    </>
  )
}
