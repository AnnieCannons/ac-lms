import { DocH2, DocH3, DocP, DocList, DocNote } from '@/components/docs/DocComponents'

export default function Observer() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Observer Mode</h1>
      <p className="text-sm text-muted-text mb-8">What the Observer role means and how it affects what you can do.</p>

      <DocH2>What Is Observer Mode?</DocH2>
      <DocP>
        If you are enrolled in a course as an <strong>Observer</strong>, you have read-only access to the course. This
        status is typically used for students on leave who still need to follow along with course content but are not
        actively participating.
      </DocP>

      <DocH2>What You Can Do as an Observer</DocH2>
      <DocList>
        <li>View the Course Outline — modules, days, and published content</li>
        <li>Read assignment instructions</li>
        <li>Access resources (videos, readings, links, files)</li>
        <li>View published quizzes and their questions</li>
        <li>Star and mark resources complete for your own tracking</li>
      </DocList>

      <DocH2>What Is Disabled</DocH2>
      <DocList>
        <li>Submitting assignments</li>
        <li>Turning in or resubmitting work</li>
        <li>Taking or retaking quizzes</li>
        <li>Receiving grades</li>
      </DocList>

      <DocNote>
        If you try to submit an assignment or take a quiz, you&apos;ll see a message indicating that submissions are
        disabled for observers.
      </DocNote>

      <DocH3>Returning to Active Status</DocH3>
      <DocP>
        When you return from leave and need full student access restored, contact your instructor or program coordinator.
        They can update your enrollment role to <strong>Student</strong>, which re-enables all submission capabilities.
      </DocP>

      <DocH2>Questions?</DocH2>
      <DocP>
        If you have questions about your observer status or need to change your enrollment, reach out to your instructor
        directly. They manage enrollments and can update your role.
      </DocP>
    </>
  )
}
