import { DocH3, DocP, DocList, DocTip, DocNote, DocStep, DocCode } from '@/components/docs/DocComponents'
import { DocAccordion } from '@/components/docs/DocAccordion'

export default function Quizzes() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Quizzes</h1>
      <p className="text-sm text-muted-text mb-8">Create knowledge checks, set attempt limits, and review results.</p>

      <DocAccordion
        items={[
          {
            id: 'creating',
            title: 'Creating a Quiz',
            content: (
              <>
                <DocStep number={1}>Click <strong>Quizzes</strong> in the course sidebar.</DocStep>
                <DocStep number={2}>Click <strong>+ New Quiz</strong>.</DocStep>
                <DocStep number={3}>
                  In the panel that opens, type a title in the <strong>Quiz title</strong> field, and optionally choose a{' '}
                  <strong>Week</strong> from the dropdown (shown only if your course has module weeks — pick{' '}
                  <em>— Week (optional) —</em> to leave it unassigned for now).
                </DocStep>
                <DocStep number={4}>Click <strong>Create Quiz →</strong>. The quiz is created unpublished, with no questions yet, and opens in the quiz editor.</DocStep>
                <DocStep number={5}>Add questions — see <strong>Adding Questions</strong> below — then set a due date, attempts, and day as needed.</DocStep>
                <DocStep number={6}>Toggle <strong>○ Unpublished</strong> to <strong>● Published</strong> when you&rsquo;re ready for students to see it.</DocStep>
                <DocNote>
                  You can also create a quiz already pinned to a specific day: open the <strong>+ Add</strong> dropdown on
                  that day in the Course Editor and choose <strong>Quiz</strong>, or use the sidebar&rsquo;s{' '}
                  <strong>+ Create</strong> button and pick <strong>Quiz</strong> as the type. Both let you choose a
                  Module and Day up front. See <strong>Course Editor</strong> in the docs for details on that button.
                  Creating a quiz this way from a Career Development module cross-posts it onto the matching coding-track
                  day (shown there with a &ldquo;Career Dev&rdquo; badge) — see <strong>Career Development</strong> in
                  the docs for how cross-posting works.
                </DocNote>
              </>
            ),
          },
          {
            id: 'adding-questions',
            title: 'Adding Questions',
            content: (
              <>
                <DocP>
                  Open a quiz from the Quizzes list, then click <strong>✎ Edit questions &amp; answers</strong> to enter
                  edit mode. From there you can add questions one at a time or paste in several at once.
                </DocP>

                <DocH3>Adding One Question at a Time</DocH3>
                <DocStep number={1}>Click <strong>+ Add question</strong> to append a blank multiple-choice question.</DocStep>
                <DocStep number={2}>
                  Use the <strong>Multiple choice</strong> / <strong>True / False</strong> toggle to set the question
                  type. Switching to True / False replaces the choices with True and False automatically.
                </DocStep>
                <DocStep number={3}>
                  Type the question text in the editor box. The toolbar above it supports <strong>B</strong> (bold),{' '}
                  <em>I</em> (italic), bullet and numbered lists, <DocCode>`code`</DocCode> (inline code),{' '}
                  <DocCode>{'</>'}</DocCode> (a multi-line code block), and an <strong>img:</strong> upload button for
                  inserting an image directly into the question.
                </DocStep>
                <DocStep number={4}>
                  For multiple choice, click <strong>+ Add choice</strong> to add more answer options (answer text
                  supports inline code, a code block, and image upload, but not bold/italic/lists). Click{' '}
                  <strong>Remove choice</strong> to delete one (at least 2 must remain).
                </DocStep>
                <DocStep number={5}>
                  Click the box to the left of a choice to mark it correct — it fills in teal with a{' '}
                  <strong>✓</strong>. Only one choice can be correct.
                </DocStep>
                <DocStep number={6}>Click <strong>Save questions</strong> when you&rsquo;re done, or <strong>Cancel</strong> to discard your changes.</DocStep>
                <DocTip>
                  Click <strong>Remove question</strong> on any question to delete it (disabled if it&rsquo;s the only
                  question left). Drag a question by its grip handle (⠿) to reorder it.
                </DocTip>

                <DocH3>Code Snippets</DocH3>
                <DocP>
                  Any question can carry a separate, syntax-highlighted code block shown below the question text (in
                  addition to any inline code or code block you put in the question text itself):
                </DocP>
                <DocStep number={1}>Click <strong>+ Add code snippet</strong> below the question text.</DocStep>
                <DocStep number={2}>Paste or type your code into the code editor that appears.</DocStep>
                <DocStep number={3}>
                  Use the language dropdown to set the language — <strong>JavaScript</strong>, <strong>React (JSX)</strong>,{' '}
                  <strong>HTML</strong>, <strong>CSS</strong>, or <strong>SQL</strong>.
                </DocStep>
                <DocStep number={4}>Click <strong>Remove snippet</strong> to take it off the question.</DocStep>

                <DocH3>Bulk-Importing Questions</DocH3>
                <DocP>
                  From the same edit-questions view, click <strong>+ Bulk import</strong> to open a text box and paste in
                  several questions at once. Imported questions are appended to the end of the current list — they
                  don&rsquo;t replace what&rsquo;s already there. Two formats are recognized:
                </DocP>
                <DocList>
                  <li>
                    <strong>Simple format</strong> — one question per block, separated by a blank line. The first line
                    is the question text; each line after it is an answer choice, in any order you like. The{' '}
                    <em>first choice listed is always the correct one</em>, so put the right answer first, e.g.:
                    <br />
                    <DocCode>What is typeof null?</DocCode> / <DocCode>&quot;object&quot;</DocCode> /{' '}
                    <DocCode>&quot;null&quot;</DocCode> / <DocCode>&quot;undefined&quot;</DocCode>
                  </li>
                  <li>
                    <strong>Lettered format</strong> — number each question (<DocCode>1. Question text?</DocCode>) and
                    label choices <DocCode>A.</DocCode> through <DocCode>D.</DocCode> (only letters A–D are recognized,
                    so a lettered question can have at most 4 choices). Add an <DocCode>Answer: B</DocCode> line to mark
                    the correct choice — if you omit it, the first lettered choice is treated as correct. Any unlabeled
                    lines you paste between the question and the first lettered choice are captured as a code snippet
                    with indentation preserved.
                  </li>
                </DocList>
                <DocList>
                  <li>Fenced code blocks (<DocCode>```js ... ```</DocCode>) work in either format and set the snippet&rsquo;s language automatically</li>
                  <li>Inline <DocCode>`backtick code`</DocCode> in a question or choice line renders as inline code</li>
                  <li>If the first choice listed is exactly &ldquo;True&rdquo; or &ldquo;False&rdquo; (regardless of which choice is marked correct), the question is automatically saved as a True/False type</li>
                </DocList>
                <DocP>
                  As you type or paste, the panel shows a live count — &ldquo;N question(s) detected — will be
                  appended&rdquo; — before you commit. Click <strong>Import</strong> (it reads <strong>Import (Nq)</strong>{' '}
                  once you&rsquo;ve pasted something) to append them, or the <strong>×</strong> in the panel header to
                  cancel.
                </DocP>
                <DocNote>
                  You don&rsquo;t need to format pasted code perfectly — just make sure the content is there. You can
                  adjust the code language and clean up formatting manually afterward, question by question.
                </DocNote>
              </>
            ),
          },
          {
            id: 'metadata',
            title: 'Due Dates, Attempts, Week & Day',
            content: (
              <>
                <DocP>
                  All quiz metadata is editable directly on the quiz page — no separate edit button needed:
                </DocP>
                <DocList>
                  <li><strong>Title</strong> — click into the title text and edit it directly; it saves automatically when you click away</li>
                  <li><strong>Due date</strong> — click <em>+ Add due date</em> to set one, or <em>× No due date</em> to clear it; times display in your local timezone next to the date picker</li>
                  <li><strong>Week</strong> — dropdown to assign the quiz to a module week (shown only if the course has weeks)</li>
                  <li><strong>Day</strong> — dropdown to pin it to Monday through Friday, or leave it <em>— Unassigned —</em></li>
                  <li><strong>Attempts</strong> — <strong>Unlimited</strong> / <strong>Limited</strong> toggle, covered next</li>
                </DocList>
                <DocNote>Every field auto-saves as soon as you change it — there&rsquo;s no separate save step for metadata.</DocNote>

                <DocH3>Max Attempts</DocH3>
                <DocP>
                  Click <strong>Unlimited</strong> to remove any cap on retakes. Click <strong>Limited</strong> to open a
                  small popover — enter a number and click <strong>Set</strong> to cap attempts at that count (the
                  button then reads <strong>Limited · N</strong>).
                </DocP>
                <DocTip>
                  Set attempts to <strong>Limited · 1</strong> to make a quiz non-retakeable. Limited · 2 or 3 lets
                  students practice on questions they got wrong.
                </DocTip>

                <DocH3>Pinning to a Day</DocH3>
                <DocP>
                  Pinning a quiz to a day makes it appear on that day&rsquo;s card in the Course Outline, for both
                  instructors and students. Use the <strong>Day</strong> dropdown described above, or — from the
                  Quizzes list — click the <strong>⇄</strong> button on a quiz row to open a &ldquo;Move To&rdquo;
                  popup where you can set its Week and Day together without opening the quiz.
                </DocP>
                <DocNote>
                  Quizzes without a pinned day still appear on the Quizzes list page but not on any day card.
                </DocNote>
              </>
            ),
          },
          {
            id: 'quizzes-list',
            title: 'The Quizzes List',
            content: (
              <>
                <DocP>
                  The <strong>Quizzes</strong> page groups every quiz by module week, in draggable, collapsible cards.
                  Each quiz row shows its title, due date, question count, and a pill for attempts (&ldquo;Up to N
                  attempts&rdquo;) and code content (&ldquo;code&rdquo;) when applicable.
                </DocP>
                <DocList>
                  <li>Click a quiz row (or <strong>View / Edit →</strong>) to open it in the full editor</li>
                  <li>Click the <strong>Published</strong> / <strong>Draft</strong> pill to publish or unpublish a quiz right from the list</li>
                  <li>Use <strong>Expand all</strong> / <strong>Collapse all</strong> at the top of the list to open or close every week&rsquo;s group at once</li>
                  <li>Drag a week group by its grip handle (⠿) to reorder weeks; drag a quiz row within a group to reorder quizzes</li>
                </DocList>
                <DocNote>
                  Deleting a quiz (via <strong>Delete quiz</strong> in the quiz editor) moves it to the course{' '}
                  <strong>Trash</strong> rather than erasing it right away — see <strong>Course Editor</strong> in the
                  docs for how to restore it. Restored quizzes always come back unpublished.
                </DocNote>
              </>
            ),
          },
          {
            id: 'conducting',
            title: 'Conducting a Quiz During Class',
            content: (
              <>
                <DocP>
                  Many quizzes are run live during class rather than assigned as homework. Once a quiz is published,
                  its row in the Quizzes list shows two links, <strong>▶ Moderate</strong> and <strong>Results</strong>{' '}
                  — and the quiz editor&rsquo;s own header shows a single <strong>▶ Moderate quiz</strong> link. All
                  three open the same live dashboard; only the Moderate variants additionally pin a shortcut back to
                  it in your sidebar until you stop.
                </DocP>
                <DocStep number={1}>Open the quiz and make sure it has <strong>no due date</strong> if you want it purely instructor-timed rather than deadline-driven.</DocStep>
                <DocStep number={2}>Toggle it to <strong>● Published</strong> right as class begins, or ahead of time if you want it ready to go.</DocStep>
                <DocStep number={3}>Tell students to open <strong>Quizzes</strong> in their own sidebar (or find it on the day card, if pinned).</DocStep>
                <DocStep number={4}>
                  Click <strong>▶ Moderate</strong> on the quiz row to open the live dashboard. It shows a{' '}
                  <strong>Live</strong> indicator, a running count of submitted / in progress / not started, and a
                  per-student table with status, score, attempt count, and time spent — including a live progress bar
                  (e.g. &ldquo;3/5&rdquo; questions answered) for students who&rsquo;ve started but not yet submitted.
                </DocStep>
                <DocStep number={5}>
                  The table refreshes automatically every 5 seconds; click <strong>Refresh now</strong> to force an
                  update immediately. Click <strong>Stop Moderating</strong> when class ends to remove the sidebar
                  shortcut (the page itself, and its data, stay available — just click <strong>Results</strong> to
                  return to it later).
                </DocStep>
                <DocTip>
                  Leave attempts set to <strong>Unlimited</strong> if you want to allow a retry after class. For a
                  one-time in-class check, set attempts to <strong>Limited · 1</strong> so students can&rsquo;t retake
                  it later.
                </DocTip>
              </>
            ),
          },
          {
            id: 'submissions',
            title: 'Viewing Quiz Submissions',
            content: (
              <>
                <DocP>
                  Click <strong>Quiz Submissions</strong> in the course sidebar for a course-wide view: every quiz in
                  the course, each with its own table of student scores, attempt counts, per-attempt duration, and
                  submission time, plus a &ldquo;X / Y submitted&rdquo; count per quiz.
                </DocP>
                <DocNote>
                  This page is a snapshot as of when you loaded it — reload to refresh. For a live, auto-updating view
                  while a quiz is actively running, use <strong>▶ Moderate</strong> / <strong>Results</strong> on that
                  quiz instead (see <strong>Conducting a Quiz During Class</strong> above).
                </DocNote>
                <DocP>Students can see their own score immediately after submitting.</DocP>
              </>
            ),
          },
        ]}
      />
    </>
  )
}
