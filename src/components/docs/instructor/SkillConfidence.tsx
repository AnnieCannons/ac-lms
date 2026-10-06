import Link from 'next/link'
import { DocAccordion, type DocAccordionItem } from '@/components/docs/DocAccordion'
import { DocH3, DocP, DocList, DocNote, DocTip, DocStep } from '@/components/docs/DocComponents'

const items: DocAccordionItem[] = [
  {
    id: 'what-is-it',
    title: 'What Skill Confidence Is',
    content: (
      <>
        <DocP>
          Skill Confidence lets students rate how confident they feel on the skills you tag on assignments, set goals for the ones they want to strengthen, and reflect on what helped them get there. For you, it shows how a class feels about each skill, how each student&apos;s confidence changes over time, and which kinds of support students say help.
        </DocP>
        <DocP>It works in three steps:</DocP>
        <DocStep number={1}>
          You tag assignments with skills in the assignment editor (see{' '}
          <Link href="/docs/instructor/assignments" className="text-teal-primary hover:underline">Assignments &amp; Grading</Link>).
        </DocStep>
        <DocStep number={2}>
          Students rate each tagged skill from 1 to 10 the first time they turn the assignment in. Every rating is optional, and they can also set a goal with a target date and a study plan.
        </DocStep>
        <DocStep number={3}>
          When a student reaches a goal, they are invited to say what helped. Over time those answers build the patterns you can see here.
        </DocStep>
        <DocH3>Where to find it</DocH3>
        <DocP>
          Open a course and click <strong>Skill Confidence</strong> in the course sidebar. It has three tabs: <strong>Class overview</strong>, <strong>By student</strong>, and <strong>Patterns</strong>.
        </DocP>
        <DocH3>Who can use it</DocH3>
        <DocList>
          <li>Admins, instructors and staff can open it. TAs cannot.</li>
          <li>It is read-only. You cannot answer questions, set goals or change ratings for a student.</li>
          <li>It covers the skills tagged on this course, and only students who are currently enrolled in it.</li>
        </DocList>
        <DocNote>
          Students are told that their ratings and goals are not part of their grades.
        </DocNote>
      </>
    ),
  },
  {
    id: 'class-overview',
    title: 'Class Overview',
    content: (
      <>
        <DocP>
          The <strong>Class overview</strong> tab has a card for each skill tagged on this course that at least one student has rated. It shows where the class is now, using each student&apos;s most recent rating of that skill from this course.
        </DocP>
        <DocList>
          <li><strong>Students rated</strong> — how many students rated the skill, for example &ldquo;6 students rated&rdquo;.</li>
          <li><strong>Average and median</strong> — the average and the middle rating.</li>
          <li><strong>Distribution</strong> — ten bars, one for each rating from 1 to 10. Hover over or focus on a bar to see how many students chose it.</li>
        </DocList>
        <DocP>
          Use <strong>Skills</strong> to narrow the cards to one or more skills, and <strong>Sort</strong> to change their order.
        </DocP>
        <DocTip>
          Using a keyboard? Press <strong>Tab</strong> to reach a card&apos;s bars as a single stop, then the <strong>arrow keys</strong>, <strong>Home</strong> or <strong>End</strong> to move between them.
        </DocTip>
        <DocNote>
          A single average can hide a few students who feel quite differently from the rest. The distribution bars are there to show that spread.
        </DocNote>
      </>
    ),
  },
  {
    id: 'by-student',
    title: 'By Student',
    content: (
      <>
        <DocP>
          The <strong>By student</strong> tab lists every student currently enrolled in the course, so you can look at one student&apos;s progress at a time.
        </DocP>
        <DocStep number={1}>Open the <strong>By student</strong> tab.</DocStep>
        <DocStep number={2}>Find the student. Scroll the list, or use <strong>Student</strong> to pick one. <strong>Skills</strong> narrows what is shown, and <strong>Sort</strong> orders the list.</DocStep>
        <DocStep number={3}>Click the student&apos;s row to open it. <strong>Expand all</strong> and <strong>Collapse all</strong> open or close every row.</DocStep>
        <DocStep number={4}>Open <strong>Skills</strong> to see each skill they have rated, or <strong>What tends to help this student</strong> to see their own patterns.</DocStep>
        <DocP>For each skill, you see the same card the student sees on their own page:</DocP>
        <DocList>
          <li>A chart of their ratings over time, with a marker where a new course&apos;s ratings begin and a dashed line for their goal.</li>
          <li>Their latest rating beside their current goal, target date and planned study methods.</li>
          <li>Earlier goals, and what helped them reach the ones they reached. An answer they have not given yet shows as &ldquo;Not answered yet&rdquo;, which is not a shortfall.</li>
          <li>A dated list of every rating, with the assignment and course it was given on.</li>
        </DocList>
        <DocP>
          A skill whose latest rating is 10 shows &ldquo;You&apos;re maintaining this rating&rdquo;. If the student later picks a lower rating, it goes back to working toward a goal, and no history is ever hidden.
        </DocP>
        <DocH3>Earlier courses</DocH3>
        <DocP>
          If a student rated the same skill in another course, those ratings appear on the same chart, labeled <strong>Earlier course (read-only)</strong>. This is shown only for skills tagged on this course. It is context for you and is never counted in the class overview.
        </DocP>
        <DocH3>Students with no ratings</DocH3>
        <DocP>
          A student who has not rated any skill on this course is listed with &ldquo;No ratings yet&rdquo;, so you can tell &ldquo;hasn&apos;t rated&rdquo; apart from &ldquo;not shown&rdquo;. It can simply mean they have not turned in a tagged assignment yet, they turned it in before the skill was tagged, or they chose not to rate, since ratings are optional. It says nothing about how the student is doing.
        </DocP>
      </>
    ),
  },
  {
    id: 'patterns',
    title: 'Patterns',
    content: (
      <>
        <DocP>
          When a student reaches a goal, they can say what helped, such as practicing on their own, getting help from a TA, or studying flashcards. The <strong>Patterns</strong> tab shows those answers across the class: how many times each method was named, and for which skills.
        </DocP>
        <DocList>
          <li>Each method shows how many times it was named, with a tag for each skill and its count. A <strong>+N more</strong> button shows the rest when there are many.</li>
          <li>The line at the top says how many answers the counts are based on, and from how many students.</li>
          <li>One goal can name several methods, so the counts are not meant to add up to the number of goals.</li>
          <li>Write-ins and &ldquo;Other&rdquo; answers are grouped under a single <strong>Other</strong>. The text students write is never shown here.</li>
          <li>Use <strong>Skills</strong> to look at one or more skills. The Student filter does not apply, so this tab always covers the whole class.</li>
        </DocList>
        <DocP>
          Each student&apos;s own patterns are on the <strong>By student</strong> tab, under <strong>What tends to help this student</strong>.
        </DocP>
        <DocNote>
          Patterns describe what students say went along with their progress. They do not prove that a method caused it, and they should not be used to rank methods or compare students.
        </DocNote>
        <DocNote>
          The class view never names students. In a small group, though, a count of one can still be a single student&apos;s answer, so share class patterns with care.
        </DocNote>
      </>
    ),
  },
  {
    id: 'using-it-well',
    title: 'Using It Well',
    content: (
      <>
        <DocList>
          <li>Ratings are how a student feels, not a measure of what they know or can do. A low rating is a useful place to offer support, not a verdict.</li>
          <li>Confidence naturally goes up and down, and a student may lower a rating for a skill they have not used in a while. That is a normal part of the process.</li>
          <li>Leaving a rating blank is always allowed, so a missing rating is not a concern in itself.</li>
          <li>Ratings and goals are not part of grading. They do not appear on the grading page.</li>
        </DocList>
        <DocP>
          To see the rating card as a student does, use{' '}
          <Link href="/docs/instructor/student-preview" className="text-teal-primary hover:underline">Student View</Link>{' '}
          and open an assignment that has tagged skills. You can try the card, but nothing is saved.
        </DocP>
      </>
    ),
  },
]

export default function SkillConfidence() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Skill Confidence</h1>
      <p className="text-sm text-muted-text mb-8">See how your class feels about the skills you tag, and what tends to help.</p>
      <DocAccordion items={items} />
    </>
  )
}
