import { DocH2, DocH3, DocP, DocList, DocTip, DocStep } from '@/components/docs/DocComponents'

export default function Flashcards() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Flashcard App</h1>
      <p className="text-sm text-muted-text mb-8">Study smarter with spaced repetition flashcards.</p>

      <DocH2>What Is the Flashcard App?</DocH2>
      <DocP>
        The Flashcard App is a built-in study tool that uses <strong>spaced repetition</strong> — a learning technique that shows you cards at the right moment, just before you&apos;re likely to forget them. Instead of re-reading notes, you actively recall information and rate how well you remembered it. The app then schedules each card based on your rating.
      </DocP>
      <DocTip>
        Spaced repetition is one of the most effective study methods backed by research. Short daily sessions are more effective than long cramming sessions.
      </DocTip>

      <DocH2>Finding the Flashcard App</DocH2>
      <DocP>
        You can open the Flashcard App two ways:
      </DocP>
      <DocList>
        <li>Click the <strong>Tools</strong> dropdown in the top navigation bar and select <strong>Flashcard App</strong>.</li>
        <li>In your course sidebar, scroll to the <strong>Level Up Your Skills</strong> section — <strong>Flashcard App</strong> appears just below it as its own link.</li>
      </DocList>
      <DocP>
        Your <strong>My Decks</strong> page shows all your decks. Each card shows how many cards are <strong>New</strong>, <strong>In Progress</strong>, or ready to <strong>Review</strong>.
      </DocP>

      <DocH2>Card Types</DocH2>
      <DocP>There are three types of flashcards:</DocP>
      <DocH3>Basic</DocH3>
      <DocP>A classic front-and-back flashcard. You see a question on the front, think of your answer, then flip to reveal the back.</DocP>
      <DocH3>Type In</DocH3>
      <DocP>You type your answer before seeing the correct one. Good for practicing exact terms, syntax, or definitions.</DocP>
      <DocH3>Fill in the Blank</DocH3>
      <DocP>A sentence with one word or phrase hidden. Click the blank to reveal it. Useful for vocabulary and context-based recall.</DocP>

      <DocH2>Studying a Deck</DocH2>
      <DocStep number={1}>From My Decks, click <strong>Study →</strong> on any deck.</DocStep>
      <DocStep number={2}>Read the question and try to recall the answer before flipping.</DocStep>
      <DocStep number={3}>Click the card (or press <strong>Space</strong>) to reveal the answer.</DocStep>
      <DocStep number={4}>Rate how well you remembered it using one of the four buttons.</DocStep>

      <DocH2>Rating Your Cards</DocH2>
      <DocP>After revealing an answer, rate yourself honestly — the app schedules the next review based on your rating:</DocP>
      <DocList>
        <li><strong>Again</strong> — you didn&apos;t know it. The card comes back in about 1 minute.</li>
        <li><strong>Hard</strong> — you got it but it was difficult. Comes back shortly.</li>
        <li><strong>Good</strong> — you knew it with some effort. Scheduled for later today or tomorrow.</li>
        <li><strong>Easy</strong> — you knew it immediately. Scheduled days out.</li>
      </DocList>
      <DocTip>
        The interval shown above each button is when that card will next appear. Cards you&apos;ve studied before will show longer intervals as you keep getting them right.
      </DocTip>

      <DocH2>Keyboard Shortcuts</DocH2>
      <DocList>
        <li><strong>Space</strong> — flip the card or reveal the blank</li>
        <li><strong>1</strong> — Again</li>
        <li><strong>2</strong> — Hard</li>
        <li><strong>3</strong> — Good</li>
        <li><strong>4</strong> — Easy</li>
        <li><strong>Escape</strong> — exit the session and return to your deck</li>
      </DocList>

      <DocH2>Importing a Deck</DocH2>
      <DocP>
        Your instructor may share a deck with you via a link. To import it, click <strong>Import Deck</strong> on the My Decks page and paste the share link. The deck is copied to your account as your own editable version — your progress is tracked separately.
      </DocP>

      <DocH2>Creating Your Own Decks</DocH2>
      <DocP>
        Click <strong>+ New Deck</strong> to create a deck. Give it a title, add optional tags, then add cards one at a time using any of the three card types.
      </DocP>
    </>
  )
}
