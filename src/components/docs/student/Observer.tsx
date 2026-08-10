import { DocAccordion } from '@/components/docs/DocAccordion'
import { DocH3, DocP, DocList, DocNote, DocTip, DocStep } from '@/components/docs/DocComponents'

export default function Observer() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Observer Mode</h1>
      <p className="text-sm text-muted-text mb-8">For students who need to step back from active participation temporarily.</p>

      <DocAccordion items={[
        {
          id: 'what-it-means',
          title: 'What Observer Status Means',
          content: (
            <>
              <DocP>
                Observer is a course enrollment role your instructor can set when you need to step away from active
                participation — for leave, a break, or any other reason. It&apos;s specific to one course, so
                you could be an Observer in one course while staying a full Student in another. Your access to
                course content continues so you can keep following along at your own pace, but submitting new
                work is paused until an instructor moves you back to Student.
              </DocP>
              <DocP>
                Observer status doesn&apos;t show up as a badge anywhere on your own dashboard. You&apos;ll notice it
                when you open an assignment or quiz and see a message explaining that submissions are paused
                because you&apos;re currently on leave — that&apos;s the same thing as Observer status.
              </DocP>
              <DocNote>
                Observer mode is a pause, not an end. When you&apos;re ready to return to active participation, your
                instructor can restore your full student access.
              </DocNote>
              <DocH3>Your Previous Work Is Safe</DocH3>
              <DocP>
                All submissions, grades, comments, and progress you had before switching to Observer status remain in
                your account exactly as you left them. Nothing is deleted or reset.
              </DocP>
            </>
          ),
        },
        {
          id: 'still-available',
          title: 'What You Can Still Do',
          content: (
            <>
              <DocP>As an Observer, you keep full read access to your course:</DocP>
              <DocList>
                <li>View the Course Outline — all published modules, weeks, and day cards</li>
                <li>Open Grades to read assignment instructions and review your previous submissions and grades</li>
                <li>Open Quizzes to view published quizzes and review your previous quiz results</li>
                <li>Star resources and mark them complete from the Course Outline or a day page, for your own tracking</li>
                <li>Read existing comments on your submissions</li>
                <li>Open Benefits and Paid Time Off, if your course offers them</li>
              </DocList>
            </>
          ),
        },
        {
          id: 'paused',
          title: "What's Paused While You're an Observer",
          content: (
            <>
              <DocP>While your enrollment is in Observer status, the following are unavailable:</DocP>
              <DocList>
                <li>Submitting, saving a draft of, or resubmitting an assignment — the Submit, Save draft, and Resubmit controls are hidden</li>
                <li>Checking off checklist items on an assignment — items appear dimmed and can&apos;t be clicked</li>
                <li>Taking or retaking a quiz — a quiz you haven&apos;t started shows &ldquo;Not available (on leave)&rdquo; instead of a link to take it</li>
                <li>Requesting an extension on an assignment</li>
                <li>Posting a new comment on a submission — existing comments are still visible, you just can&apos;t add one</li>
                <li>Opening General Info, Class Resources, Career Development, or Level Up Your Skills from the sidebar — these send you back to My Courses while you&apos;re an Observer</li>
              </DocList>
              <DocNote>
                If you try to submit an assignment or take a quiz while in Observer mode, you&apos;ll see a message
                explaining that you&apos;re currently on leave and submissions are paused. This is not an error — it
                just means your enrollment is in Observer status.
              </DocNote>
            </>
          ),
        },
        {
          id: 'returning',
          title: 'Returning to Active Status',
          content: (
            <>
              <DocP>
                When you&apos;re ready to return and need full student access restored, reach out to your instructor
                or program coordinator.
              </DocP>
              <DocStep number={1}>
                Message your instructor or program coordinator and let them know you&apos;re ready to return to active
                participation.
              </DocStep>
              <DocStep number={2}>
                Your instructor changes your enrollment role from Observer back to Student on their end.
              </DocStep>
              <DocStep number={3}>
                Submitting assignments, checking off checklist items, taking quizzes, and requesting extensions all
                unlock right away.
              </DocStep>
              <DocTip>
                You don&apos;t need to explain your situation in detail to request a status change — simply letting
                your instructor know you&apos;re ready to return is enough.
              </DocTip>
              <DocP>
                If you have questions about why you&apos;re in Observer mode or want to discuss your enrollment,
                reach out to your instructor directly. They manage enrollments and are the right person to help.
              </DocP>
            </>
          ),
        },
      ]} />
    </>
  )
}
