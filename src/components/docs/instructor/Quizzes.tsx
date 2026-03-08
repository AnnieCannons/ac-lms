import { DocH2, DocH3, DocP, DocList, DocTip, DocNote, DocStep, DocCode } from '@/components/docs/DocComponents'

export default function Quizzes() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Quizzes</h1>
      <p className="text-sm text-muted-text mb-8">Create knowledge checks, set attempt limits, and review results.</p>

      <DocH2>Creating a Quiz</DocH2>
      <DocStep number={1}>Navigate to <strong>Quizzes</strong> in the course sidebar.</DocStep>
      <DocStep number={2}>Click <strong>+ New Quiz</strong>. A panel opens where you can name the quiz and optionally paste in questions.</DocStep>
      <DocStep number={3}>To bulk-import questions, paste them into the text area (see format below). Or leave it empty to start blank and add questions individually.</DocStep>
      <DocStep number={4}>Click <strong>Create Quiz</strong>. The quiz opens in the editor where you can set a due date, max attempts, and add or edit questions.</DocStep>
      <DocStep number={5}>Publish the quiz when ready for students.</DocStep>

      <DocH2>Pasting Questions in Bulk</DocH2>
      <DocP>
        When creating a new quiz, paste questions directly into the text area. The format is flexible — blank lines
        separate questions, and the first answer is always treated as correct.
      </DocP>
      <DocList>
        <li>Question text on the first line (or numbered: <DocCode>1. Question?</DocCode>)</li>
        <li>Each answer on its own line — first answer = correct</li>
        <li>Choice labels (<DocCode>a)</DocCode>, <DocCode>b)</DocCode>, etc.) are optional</li>
        <li>Blank line between questions</li>
        <li>Fenced code blocks (<DocCode>```js</DocCode>) attach to the preceding question as a code snippet</li>
        <li>Inline <DocCode>`backtick code`</DocCode> is rendered as code in the question text</li>
      </DocList>
      <DocTip>
        If the first answer is &ldquo;True&rdquo; or &ldquo;False&rdquo;, the question is automatically marked as true/false type.
      </DocTip>

      <DocH2>Question Types</DocH2>
      <DocList>
        <li><strong>Multiple Choice</strong> — one correct answer from several options</li>
        <li><strong>True / False</strong> — a statement students mark as true or false</li>
      </DocList>

      <DocH3>Code Snippets</DocH3>
      <DocP>
        Any question can include a code snippet. Toggle the code snippet switch in the question editor and paste your
        code. It renders in a syntax-highlighted code block for students.
      </DocP>

      <DocH2>Max Attempts</DocH2>
      <DocP>
        Set a maximum number of attempts on a quiz. When the limit is reached, students can no longer retake the quiz.
        Leave blank for unlimited attempts.
      </DocP>
      <DocTip>
        Setting max attempts to 1 effectively makes the quiz non-retakeable. Setting it to 2 or 3 allows students to
        practice on wrong questions.
      </DocTip>

      <DocH2>Pinning to a Day</DocH2>
      <DocP>
        Assign a quiz to a specific day (Monday–Thursday) within its module week. This makes the quiz appear on the
        corresponding day card in the Course Outline, both for instructors and students.
      </DocP>
      <DocStep number={1}>Open the quiz in the Quizzes section.</DocStep>
      <DocStep number={2}>Use the <strong>Day</strong> dropdown to select Mon, Tue, Wed, or Thu.</DocStep>
      <DocStep number={3}>The quiz now appears in the Course Outline on that day.</DocStep>

      <DocNote>
        Quizzes without a pinned day still appear on the Quizzes list page but not on day cards.
      </DocNote>

      <DocH2>Publishing a Quiz</DocH2>
      <DocP>
        Quizzes are <strong>unpublished</strong> by default. Toggle the <strong>Published</strong> switch in the quiz
        editor to make it visible to students. You can also publish directly from the Course Outline accordion.
      </DocP>

      <DocH2>Viewing Quiz Submissions</DocH2>
      <DocP>
        Navigate to <strong>Quizzes → Quiz Submissions</strong> (or the Submissions tab in the quizzes section) to see a
        table of all student submissions, scores, and attempt counts across all quizzes.
      </DocP>
    </>
  )
}
