import { DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'
import { DocAccordion } from '@/components/docs/DocAccordion'

export default function Quizzes() {
  const items = [
    {
      id: 'finding',
      title: 'Finding Your Quizzes',
      content: (
        <>
          <DocP>Published quizzes appear in three places:</DocP>
          <DocList>
            <li>The <strong>Quizzes</strong> page in the sidebar — lists every published quiz for the course with its due date, question count, your score, and attempts used, plus a link that reads <strong>Take quiz</strong>, <strong>Retake quiz</strong>, or <strong>View results</strong> depending on where you stand</li>
            <li><strong>Day cards</strong> in the Course Outline — expand a day to see any quizzes pinned to it, each with a <strong>Take →</strong> link that opens the quiz (or shows your results, if you&apos;ve already submitted)</li>
            <li>The <strong>day detail page</strong> — open a day to see its quizzes listed with your score and attempts used, alongside that day&apos;s resources and assignments</li>
          </DocList>
          <DocP>
            Only <strong>published</strong> quizzes are visible to students. If you&apos;re expecting a quiz that isn&apos;t showing up yet, check with your instructor.
          </DocP>
          <DocNote>
            Due dates are shown on the <strong>Quizzes</strong> list page — as a date, or &ldquo;No due date&rdquo; if your instructor didn&apos;t set one. The quiz page itself doesn&apos;t repeat the due date, so check the list if you need a reminder.
          </DocNote>
        </>
      ),
    },
    {
      id: 'taking',
      title: 'Taking a Quiz',
      content: (
        <>
          <DocTip>
            Some quizzes are run live during class — your instructor will tell you when to open the Quizzes page and start.
            These quizzes may not have a due date listed; just take them when instructed.
          </DocTip>
          <DocStep number={1}>From the <strong>Quizzes</strong> page, click a quiz card to open it.</DocStep>
          <DocStep number={2}>Read each question. Questions may include a code snippet — it&apos;s shown in a read-only, syntax-highlighted code block above the answer choices.</DocStep>
          <DocStep number={3}>Select an answer for each question. You can change your selection as many times as you like before submitting.</DocStep>
          <DocStep number={4}>Click <strong>Submit quiz</strong>. All questions must be answered before the quiz will submit.</DocStep>
          <DocTip>
            Your answers are saved automatically as you go — about a second after you pick each one. If your browser closes or you leave the page mid-quiz, come back and your selections will still be there.
          </DocTip>
          <DocNote>
            If your enrollment is in Observer status, quizzes are view-only — you&apos;ll see a message that submissions are paused while you&apos;re on leave. See the Observer Mode guide for details.
          </DocNote>
        </>
      ),
    },
    {
      id: 'scores',
      title: 'Your Score and Reviewing Answers',
      content: (
        <>
          <DocP>
            After submitting, you land on a results view and immediately see your score — how many questions you got right out of the total, plus a percentage.
          </DocP>
          <DocP>
            Every question is listed below with a checkmark or an ✗. For a question you got right, the review shows the correct answer (which is just your own pick, confirmed). For a question you missed, it shows <strong>the answer you selected</strong> — not the correct one — so use your notes or course materials to work out what you got wrong before you retake it.
          </DocP>
          <DocP>
            Score 100% and the quiz&apos;s card on the <strong>Quizzes</strong> list shows a green <strong>Complete</strong> badge.
          </DocP>
          <DocNote>
            Quiz scores are for learning — they help you see which concepts to revisit, not judge you. Use a wrong answer as a cue to review before you retake.
          </DocNote>
        </>
      ),
    },
    {
      id: 'retaking',
      title: 'Retaking a Quiz',
      content: (
        <>
          <DocP>
            If you have any wrong answers and haven&apos;t used up your attempts, you can retake the quiz — just the questions you got wrong need answering again.
          </DocP>
          <DocStep number={1}>Click <strong>Retake Quiz</strong> on your results page, or click the quiz&apos;s card again from the <strong>Quizzes</strong> list (it will read <strong>Retake quiz</strong> and take you straight into the retake).</DocStep>
          <DocStep number={2}>Questions you already got right are shown locked and dimmed, labeled <strong>&ldquo;already correct&rdquo;</strong> — you don&apos;t redo them.</DocStep>
          <DocStep number={3}>Answer the remaining questions, outlined in orange — these are the ones you got wrong.</DocStep>
          <DocStep number={4}>Click <strong>Submit quiz</strong> again. Your score and the answer review update immediately.</DocStep>
          <DocNote>
            Auto-save only restores progress on your first attempt. If you leave in the middle of a retake and come back, you&apos;ll need to re-pick answers for the questions you&apos;re redoing — the ones you already got right stay locked in either way, so you won&apos;t lose credit for them.
          </DocNote>

          <DocH3>Attempt Limits</DocH3>
          <DocP>
            Some quizzes cap the number of attempts — your instructor may set this to 1, making the quiz non-retakeable, or leave it unlimited. If a limit is set, the top of the quiz page shows how many you&apos;ve used so far (for example, &ldquo;1 of 3 attempts used&rdquo;), and your results page shows how many attempts you have left next to the Retake button.
          </DocP>
          <DocP>
            Once every attempt is used, the page shows &ldquo;All 3 attempts used&rdquo; (or however many were allowed) and the Retake button no longer appears — you can still view your past results.
          </DocP>
          <DocP>
            If you feel you need more attempts than allowed, reach out to your instructor — they can discuss options with you.
          </DocP>
        </>
      ),
    },
  ]

  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Quizzes</h1>
      <p className="text-sm text-muted-text mb-8">How to find, take, and retake quizzes.</p>
      <DocAccordion items={items} />
    </>
  )
}
