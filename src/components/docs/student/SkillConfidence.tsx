import { DocH2, DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'

export default function SkillConfidence() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Skill Confidence</h1>
      <p className="text-sm text-muted-text mb-8">Rate how confident you feel on the skills you practice, set goals, and see your progress over time.</p>

      <DocH2>What Is Skill Confidence?</DocH2>
      <DocP>
        Your instructors tag assignments with the skills they help you practice, such as HTML, Git, or Presenting. When you turn in an assignment for the first time, you can rate how confident you feel on each of those skills from 1 to 10. Over time, your ratings build a picture of how your confidence grows, and you can set goals for the skills you want to strengthen.
      </DocP>
      <DocP>
        It can also help you see how your studying shows up in your confidence. When you reach a goal, you can share what helped, such as flashcards, practicing on your own, or getting help from a TA. Over time you can see which study methods tend to go along with your confidence growing, so you can lean on what works for you.
      </DocP>
      <DocP>
        It is a tool for your own reflection, and you are in charge of it. You decide what to rate, there are no right or wrong ratings, and where you are today is simply where you are today. It can change, and the point is to notice that change over time.
      </DocP>
      <DocP>
        Your ratings and goals are <strong>not part of your grades</strong>, and they are not used when your work is graded.
      </DocP>
      <DocNote>
        This is separate from the older <strong>Confidence Tracker</strong>, where you add your own skills. Skill Confidence uses the skills your instructors tag on assignments.
      </DocNote>

      <DocH2>Rating Skills When You Turn In an Assignment</DocH2>
      <DocP>
        If an assignment has tagged skills, a <strong>How confident do you feel on the following skill(s)?</strong> card appears above the Submit button the first time you turn it in.
      </DocP>
      <DocList>
        <li><strong>It is always optional.</strong> Rate every skill, some of them, or none. There is nothing to explain or justify, and leaving a rating blank never stops you from turning in your work.</li>
        <li><strong>Pick a number from 1 to 10.</strong> Hover over or focus on a number to see what it means, from &ldquo;I just learned this exists&rdquo; (1) to &ldquo;I could teach this to someone just starting out&rdquo; (10). Click a selected number again to clear it.</li>
        <li><strong>It only appears on your first submission.</strong> If you resubmit after a revision, you will not be asked again.</li>
      </DocList>
      <DocH3>How to rate a skill</DocH3>
      <DocStep number={1}>Open an assignment that has tagged skills.</DocStep>
      <DocStep number={2}>Find the <strong>How confident do you feel on the following skill(s)?</strong> card above the Submit button.</DocStep>
      <DocStep number={3}>For each skill you want to rate, pick a number from 1 to 10.</DocStep>
      <DocStep number={4}>If you like, set a goal for a skill you rated below 10, or click <strong>Skip</strong>.</DocStep>
      <DocStep number={5}>If you set a goal, choose a target date and a study plan (see Setting a Goal below).</DocStep>
      <DocStep number={6}>Click <strong>Submit</strong> as usual. Your ratings are saved when you turn in the assignment.</DocStep>
      <DocP>
        A skill you have never rated before shows a <strong>New</strong> tag.
      </DocP>
      <DocNote>
        If your assignment is turned in but a rating could not be saved, you will see a message saying so. Your assignment is not affected, and the message is not something you did wrong.
      </DocNote>

      <DocH2>Setting a Goal</DocH2>
      <DocP>
        After you rate a skill below 10, you can choose to set a goal for it. A goal can help you plan, and it is completely fine to skip it. If you do set one, you fill in three things, in this order:
      </DocP>
      <DocStep number={1}><strong>A target rating.</strong> Pick a number higher than your current rating, up to 10, so there is room to grow. We suggest two higher, and you can change it.</DocStep>
      <DocStep number={2}><strong>A target date.</strong> Any day after today. We suggest one week from now, and you can change it.</DocStep>
      <DocStep number={3}><strong>A study plan.</strong> Choose everything that applies: practice on my own, review the lesson materials, get help from a TA or instructor, watch outside tutorials or videos, study flashcards, review class notes, or write in your own.</DocStep>
      <DocNote>
        If you start setting a goal, Submit stays off until all three parts are filled in. Click <strong>Skip</strong> to turn in without one.
      </DocNote>
      <DocP>
        If you skip a goal, you can set one later from <strong>My Skill Confidence</strong> (see below). A skill has one goal at a time. Once you reach a goal, you can set a new one, and your earlier goals stay in your history.
      </DocP>
      <DocP>
        Your target date is a guide for you, not a deadline. If it passes before you reach your goal, nothing changes: the goal stays open and you can keep working toward it at your own pace.
      </DocP>

      <DocH2>Skills You Feel Confident On</DocH2>
      <DocP>
        When your latest rating of a skill is 10, you are <strong>maintaining</strong> it. Maintained skills that are tagged on an assignment appear together in one collapsed row, <strong>Still feeling confident on your maintaining skills?</strong>, already at 10.
      </DocP>
      <DocList>
        <li>If you leave them alone, <strong>nothing is saved</strong> for those skills.</li>
        <li>If a skill no longer feels like a 10, open the row and pick a lower number. It is saved like any other rating, the skill moves to the growing section, and you can choose to set a goal for it.</li>
        <li>Picking 10 again saves a new rating of 10.</li>
      </DocList>
      <DocTip>
        Lowering a rating is completely okay. Confidence naturally goes up and down, especially with skills you have not used for a while. Choose the number that feels true for you today.
      </DocTip>

      <DocH2>After You Turn In</DocH2>
      <DocP>Depending on your ratings, you may see a short message next to your <strong>Turned in</strong> confirmation.</DocP>
      <DocH3>Progress message</DocH3>
      <DocP>If you rate a skill higher than your last rating of it, you will see something like &ldquo;Your confidence in Git went up from 4 to 6.&rdquo;</DocP>
      <DocH3>Reaching a goal</DocH3>
      <DocP>
        If your rating meets or passes a goal you set, you will see a celebration naming the skill and the goal. It also asks, <strong>What helped you reach your goal?</strong> Choose everything that applies, or skip. Each answer you share helps build the patterns on your <strong>Patterns</strong> tab (see below), which show what tends to help you. If you skip, you can answer later from My Skill Confidence, and a reminder appears in your notification bell.
      </DocP>
      <DocNote>
        It does not matter when you reach a goal. Reaching it at any time is worth celebrating. If you answer, you can also choose to set a new goal.
      </DocNote>
      <DocH3>Reaching 10</DocH3>
      <DocList>
        <li>The first time you rate a skill 10, you will see a short celebration.</li>
        <li>If you were below 10 and get back to 10, you are invited to share what helped.</li>
        <li>A rating that stays at 10 does not repeat the message.</li>
      </DocList>

      <DocH2>My Skill Confidence</DocH2>
      <DocP>
        Open <strong>Tools → Skill Confidence</strong> in the top navigation bar to see every skill you have rated, across all your courses.
      </DocP>
      <DocP>The <strong>Skills</strong> tab has two sections:</DocP>
      <DocList>
        <li><strong>Skills you&apos;re growing</strong> — skills you&apos;re actively working on, where your latest rating is below 10.</li>
        <li><strong>Skills you&apos;re maintaining</strong> — skills where your latest rating is 10. A skill moves between the two sections as your ratings change, and none of your history is ever hidden or deleted.</li>
      </DocList>
      <DocP>
        Use <strong>Choose skills to view</strong> in each section to search for skills and pick the ones you want to see. Each one shows:
      </DocP>
      <DocList>
        <li>A chart of your ratings over time in all courses. A marker shows where a new course&apos;s ratings begin, and a dashed line shows your goal.</li>
        <li>Your latest rating beside your <strong>Current goal</strong>, its target date, and your planned study methods. A skill with no goal shows <strong>Set a goal</strong>.</li>
        <li>Your earlier goals, and what helped you reach the ones you reached.</li>
        <li>A dated list of every rating, with the assignment and course it was given on, as an alternative to the chart.</li>
      </DocList>
      <DocP>
        If you have goals you reached but have not answered about yet, a line at the top says so, with a <strong>Log what helped</strong> button.
      </DocP>

      <DocH2>Patterns: What Tends to Help You</DocH2>
      <DocP>
        The <strong>Patterns</strong> tab collects your own &ldquo;what helped&rdquo; answers. For each method you chose, it shows how many times it helped and for which skills. It starts working with your very first answer and updates as you reach and answer more goals.
      </DocP>
      <DocList>
        <li>One goal can name several methods, so the counts are not meant to add up to your number of goals.</li>
        <li>Skills you wrote in yourself, or any &ldquo;Other&rdquo; text, are grouped under a single <strong>Other</strong>.</li>
        <li>If a method helped on many skills, the first ones are shown with a <strong>+N more</strong> button to see the rest.</li>
      </DocList>
      <DocNote>
        Patterns describe what has gone along with your progress. They do not prove a method caused it, and every student is different.
      </DocNote>

      <DocH2>Reminders in the Notification Bell</DocH2>
      <DocP>
        If you reach a goal and skip the &ldquo;what helped&rdquo; question, a reminder stays in your notification bell: &ldquo;You reached your goal of N in [skill]. Log what helped.&rdquo; Click it to go to My Skill Confidence, or use <strong>Clear</strong> to hide it. Answering the question removes the reminder. Clearing a reminder only hides it from the bell, and the question stays on My Skill Confidence until you answer it. Answering is optional, but each answer helps build your patterns.
      </DocP>

      <DocH2>Who Can See Your Ratings</DocH2>
      <DocList>
        <li><strong>Your grades are not affected.</strong> Ratings and goals are never part of grading.</li>
        <li><strong>You</strong> see everything on your own My Skill Confidence page.</li>
        <li><strong>Instructors and staff</strong> can see your ratings, goals and &ldquo;what helped&rdquo; answers, read-only. They can look at your progress on its own, one student at a time, and also at how the whole class is doing. They use them to understand how you and your class are growing and which kinds of support help. They cannot answer questions or set goals for you.</li>
        <li><strong>TAs and other students</strong> cannot see them.</li>
        <li>When instructors look at the whole class, the results are combined. They never name students or show the text you write in yourself.</li>
      </DocList>

      <DocH2>Using a Keyboard</DocH2>
      <DocP>
        Each group of rating or goal numbers is a single stop when you press <strong>Tab</strong>. Use the <strong>arrow keys</strong>, <strong>Home</strong> or <strong>End</strong> to move between numbers, and <strong>Space</strong> or <strong>Enter</strong> to choose one.
      </DocP>
      <DocStep number={1}>Press <strong>Tab</strong> to reach the group of numbers for a skill.</DocStep>
      <DocStep number={2}>Use the <strong>arrow keys</strong> to move to the number you want. Moving does not choose it.</DocStep>
      <DocStep number={3}>Press <strong>Space</strong> to choose it, then <strong>Tab</strong> to move on.</DocStep>
    </>
  )
}
