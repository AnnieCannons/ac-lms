import { DocH2, DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'

export default function Quizzes() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Quizzes</h1>
      <p className="text-sm text-muted-text mb-8">How to find, take, and retake quizzes.</p>

      <DocH2>Finding Quizzes</DocH2>
      <DocP>Published quizzes appear in three places:</DocP>
      <DocList>
        <li>The <strong>Quizzes</strong> page in the sidebar — lists every published quiz with your score</li>
        <li><strong>Day cards</strong> in the Course Outline — quizzes pinned to a specific day appear there</li>
        <li>The <strong>day detail page</strong> — click a day to see its quizzes alongside resources and assignments</li>
      </DocList>

      <DocH2>Taking a Quiz</DocH2>
      <DocTip>
        Some quizzes are run live during class — your instructor will tell you when to open the Quizzes page and start.
        These quizzes may not have a due date listed; just take them when instructed.
      </DocTip>
      <DocStep number={1}>Click a quiz title to open it.</DocStep>
      <DocStep number={2}>Read each question carefully. Questions may include code snippets — read them in the code block displayed on screen.</DocStep>
      <DocStep number={3}>Select your answer for each question.</DocStep>
      <DocStep number={4}>Click <strong>Submit Quiz</strong> when you&apos;re done.</DocStep>

      <DocTip>
        Your answers are saved as you go. If you accidentally navigate away, your progress is preserved and you can
        return to finish the quiz.
      </DocTip>

      <DocH2>Scores and Results</DocH2>
      <DocP>
        After submitting, you immediately see your score — the number of correct answers out of the total. Questions you
        got wrong are highlighted so you can review them.
      </DocP>

      <DocH2>Retaking a Quiz</DocH2>
      <DocP>
        If your instructor allows retakes, a <strong>Retake Quiz</strong> button appears after you see your results.
        Retakes show only the questions you answered incorrectly — you don&apos;t have to redo questions you already got
        right.
      </DocP>

      <DocH3>Attempt Limits</DocH3>
      <DocP>
        Some quizzes have a maximum number of attempts. When you reach the limit, the quiz is locked and you cannot retake
        it. Check with your instructor if you need an exception.
      </DocP>
      <DocNote>
        The number of attempts remaining (if a limit is set) is shown on the quiz page before you begin.
      </DocNote>

      <DocH2>Due Dates</DocH2>
      <DocP>
        If a quiz has a due date, it&apos;s shown on the quiz list and at the top of the quiz page. Complete the quiz
        before the due date — after it passes, the quiz may no longer be available.
      </DocP>
    </>
  )
}
