import { DocH2, DocH3, DocP, DocList, DocNote, DocTip } from '@/components/docs/DocComponents'

export default function Observer() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Observer Mode</h1>
      <p className="text-sm text-muted-text mb-8">For students who need to step back from active participation temporarily.</p>

      <DocH2>What Is Observer Mode?</DocH2>
      <DocP>
        Observer mode is for students who have <strong>paused their participation</strong> in a course. If you need
        to step away — for any reason — your instructor can set your enrollment to Observer status. Everything you&apos;ve
        done is preserved exactly as you left it, and your access to course content continues so you can follow along
        at your own pace.
      </DocP>
      <DocP>
        Observer mode is a pause, not an end. When you&apos;re ready to return to active participation, your instructor
        can restore your full student access.
      </DocP>

      <DocH2>What You Can Do as an Observer</DocH2>
      <DocList>
        <li>View the Course Outline — all published modules, weeks, and day cards</li>
        <li>Read assignment instructions and review your previous submissions</li>
        <li>Access all resources — videos, readings, links, and downloadable files</li>
        <li>View published quizzes and review your previous quiz results</li>
        <li>Star and mark resources complete for your own tracking</li>
      </DocList>

      <DocH2>What Is Temporarily Disabled</DocH2>
      <DocList>
        <li>Submitting new assignments or resubmitting existing ones</li>
        <li>Taking or retaking quizzes</li>
        <li>Receiving new grades</li>
      </DocList>

      <DocNote>
        If you try to submit an assignment or take a quiz while in Observer mode, you&apos;ll see a message explaining
        that submissions are currently disabled for your account. This is not an error — it just means your enrollment
        is in Observer status.
      </DocNote>

      <DocH3>Your Previous Work Is Safe</DocH3>
      <DocP>
        All submissions, grades, comments, and progress you had before switching to Observer status remain in your
        account. Nothing is deleted or reset.
      </DocP>

      <DocH2>Returning to Active Status</DocH2>
      <DocP>
        When you&apos;re ready to return and need full student access restored, reach out to your instructor or program
        coordinator. They can update your enrollment back to <strong>Student</strong>, which re-enables submissions,
        quizzes, and grading immediately.
      </DocP>
      <DocTip>
        You don&apos;t need to explain your situation in detail to request a status change — simply let your instructor
        know you&apos;re ready to return.
      </DocTip>

      <DocH2>Questions About Your Status</DocH2>
      <DocP>
        If you have questions about why you&apos;re in Observer mode or want to discuss your enrollment, reach out to
        your instructor directly. They manage enrollments and are the right person to help.
      </DocP>
    </>
  )
}
