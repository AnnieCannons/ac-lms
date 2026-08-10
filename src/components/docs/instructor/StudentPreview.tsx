import { DocAccordion, type DocAccordionItem } from '@/components/docs/DocAccordion'
import { DocH3, DocP, DocList, DocOL, DocTip, DocNote, DocStep, DocCode } from '@/components/docs/DocComponents'

const items: DocAccordionItem[] = [
  {
    id: 'what-is-it',
    title: 'What Is Student View?',
    content: (
      <>
        <DocP>
          Student View lets instructors, admins, TAs, and staff see a course through a student&apos;s lens — the
          student-facing layout and only published content — without logging in as an actual student.
        </DocP>
        <DocP>
          It works by setting a browser cookie scoped to one course at a time; the server checks your real role
          (instructor, admin, staff, or a course-scoped TA) before honoring it, so students can&apos;t spoof their
          way into it.
        </DocP>
        <DocNote>
          Don&apos;t confuse this with <strong>View as Student</strong>, a separate admin-only tool available from a
          student&apos;s roster page. Student View shows the course generically as any student would see it; View as
          Student steps into one specific real student&apos;s account (their actual submissions, grades, and
          progress). See the Roster guide for that feature.
        </DocNote>
      </>
    ),
  },
  {
    id: 'entering',
    title: 'How to Enter Student View',
    content: (
      <>
        <DocOL>
          <DocStep number={1}>
            Open the course in the instructor sidebar (any instructor page for that course — Course Editor,
            Grades, Gradebook, etc. all show the same sidebar).
          </DocStep>
          <DocStep number={2}>
            Near the bottom of the sidebar, click <strong>Student View</strong>.
          </DocStep>
          <DocStep number={3}>
            You&apos;re redirected to <DocCode>/student/courses/[id]</DocCode> — the same landing page a student
            sees — with an amber <strong>Student View — previewing as a student</strong> banner pinned to the top.
          </DocStep>
        </DocOL>
        <DocTip>
          Use Student View before publishing new content to check how it looks and reads from the student side —
          module ordering, resource display, and checklist wording all render exactly as students will see them.
        </DocTip>
      </>
    ),
  },
  {
    id: 'banner',
    title: 'The Student View Banner',
    content: (
      <DocP>
        While previewing, a sticky amber banner reading <strong>Student View — previewing as a student</strong> is
        pinned to the top, with a <strong>Leave Student View</strong> button on the right. It shows up on every
        student-facing page for that course — course home, General Info, day pages, assignments, quizzes, Class
        Resources, Career Development, Level Up, and the rest — not just the page you started on, so there&apos;s no
        page you can wander to and lose track of being in preview mode.
      </DocP>
    ),
  },
  {
    id: 'can-cannot',
    title: 'What You Can and Cannot Do',
    content: (
      <>
        <DocH3>You can</DocH3>
        <DocList>
          <li>Navigate the student sidebar and course outline</li>
          <li>View published modules, days, assignments, resources, and quizzes as students see them</li>
          <li>Open an assignment&apos;s checklist and check/uncheck items to see how the self-check UI behaves</li>
        </DocList>
        <DocH3>You cannot</DocH3>
        <DocList>
          <li>
            Submit an assignment — the Submit button is disabled and a notice reads{' '}
            <em>&quot;Assignment submission is disabled in Student View.&quot;</em>
          </li>
          <li>
            Answer and submit a quiz — the submit control is replaced with{' '}
            <em>&quot;Quiz submission is disabled in Student View.&quot;</em>
          </li>
          <li>Post or view threaded submission comments (hidden entirely while previewing)</li>
          <li>Click <strong>Request Extension</strong> on an assignment (the button doesn&apos;t render while previewing)</li>
        </DocList>
        <DocNote>
          Checklist checkboxes are the one interactive exception: clicking them actually saves, but only against
          your own instructor/admin account, never against a real student&apos;s record. Assignment and quiz
          submission are fully blocked, so no submission or quiz-attempt data is ever created while previewing.
        </DocNote>
      </>
    ),
  },
  {
    id: 'exiting',
    title: 'How to Exit Student View',
    content: (
      <>
        <DocOL>
          <DocStep number={1}>
            Click <strong>Leave Student View</strong> in the banner at the top of any student page.
          </DocStep>
          <DocStep number={2}>
            You&apos;re returned to <DocCode>/instructor/courses/[id]</DocCode>, the Course Editor for that course.
          </DocStep>
        </DocOL>
        <DocP>
          Landing on any instructor page also clears the preview cookie automatically, even if you didn&apos;t click{' '}
          <strong>Leave Student View</strong> and even if it&apos;s a different course&apos;s instructor page — so
          navigating back to the instructor side always ends the preview.
        </DocP>
      </>
    ),
  },
  {
    id: 'session',
    title: 'Preview Scope and Expiration',
    content: (
      <DocP>
        The preview cookie is scoped to a single course at a time (it stores that course&apos;s ID) and expires on
        its own after 24 hours even if you never explicitly leave. It is not tied to a single browser tab — opening
        the course in another tab keeps you in Student View for that course until you leave, navigate back to an
        instructor page, or the 24 hours elapse.
      </DocP>
    ),
  },
]

export default function StudentPreview() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Student Preview</h1>
      <p className="text-sm text-muted-text mb-8">See your course exactly as students see it.</p>

      <DocAccordion items={items} />
    </>
  )
}
