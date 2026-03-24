import { DocH2, DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'
import Link from 'next/link'

export default function Accessibility() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Accessibility</h1>
      <p className="text-sm text-muted-text mb-8">Display settings, screen reader support, keyboard navigation, and other tools to make the app work better for you.</p>

      <DocH2>Display Settings</DocH2>
      <DocP>
        Three display settings are available under your{' '}
        <Link href="/account" className="text-teal-primary hover:underline">Profile → Display &amp; Appearance</Link>{' '}
        panel. Changes take effect instantly and are remembered across sessions.
      </DocP>

      <DocH3>Dark Mode</DocH3>
      <DocP>
        Switches to a dark color scheme to reduce eye strain in low-light environments. Recommended for evening studying or anyone who finds bright screens uncomfortable.
      </DocP>
      <DocStep number={1}>Click your name in the top-right corner and select <strong>Profile</strong>.</DocStep>
      <DocStep number={2}>Scroll to the <strong>Display &amp; Appearance</strong> section on the page.</DocStep>
      <DocStep number={3}>Toggle <strong>Dark mode</strong> on or off.</DocStep>

      <DocH3>High Contrast</DocH3>
      <DocP>
        Maximizes contrast throughout the site — deeper background colors, brighter accent colors, and stronger text contrast. Designed for users who need sharper visual distinction between elements.
      </DocP>
      <DocNote>
        High contrast is designed to be used alongside Dark mode. Enable Dark mode first, then turn on High contrast for the strongest effect.
      </DocNote>

      <DocH3>Dyslexia-Friendly Font</DocH3>
      <DocP>
        Switches the entire site to <strong>OpenDyslexic</strong>, a typeface specifically designed to improve readability for people with dyslexia. The font uses weighted bottoms on letters to reduce rotation and confusion.
      </DocP>
      <DocTip>
        The dyslexia-friendly font can be used with or without dark mode — they are independent settings.
      </DocTip>

      <DocH2>Screen Readers</DocH2>
      <DocP>
        The app is built for compatibility with screen readers including <strong>VoiceOver</strong> (macOS and iOS), <strong>NVDA</strong> and <strong>JAWS</strong> (Windows), and <strong>TalkBack</strong> (Android). The sections below describe how specific parts of the app behave with a screen reader.
      </DocP>

      <DocH3>General</DocH3>
      <DocList>
        <li>All buttons and icon-only controls have descriptive labels read aloud — no icon is left unlabeled.</li>
        <li>Status badges (Complete, Turned In, Needs Revision, Late) always include visible text, not just color or symbols.</li>
        <li>Decorative arrows and checkmarks (→, ✓, ✗) are hidden from screen readers; meaningful equivalents like &ldquo;Correct&rdquo; or &ldquo;Incorrect&rdquo; are read instead.</li>
        <li>Error messages and save confirmations are announced automatically — you don&rsquo;t need to navigate to find them.</li>
        <li>Page navigation is announced when the route changes.</li>
        <li>Timestamps throughout the app use proper semantic markup so screen readers can communicate them accurately.</li>
      </DocList>

      <DocH3>Quizzes</DocH3>
      <DocP>
        The quiz interface has been specifically tuned for screen reader use:
      </DocP>
      <DocList>
        <li><strong>Each question</strong> is announced as a labeled group, e.g. &ldquo;Question 3, group.&rdquo; You can navigate between questions using your screen reader&rsquo;s group or landmark navigation.</li>
        <li><strong>Answer choices</strong> are a standard radio button group. Use arrow keys to move between choices within a question, and Tab to move to the next question.</li>
        <li><strong>Retake mode:</strong> Questions you already answered correctly are announced as &ldquo;Question N, already correct&rdquo; and marked disabled. Only the questions you need to redo are interactive.</li>
        <li><strong>Quiz results:</strong> After submitting, each question in the breakdown is announced as &ldquo;Correct&rdquo; or &ldquo;Incorrect&rdquo; before the question text — no need to interpret colors.</li>
        <li><strong>Score card:</strong> Your score is presented as a status region so it is read as soon as the results page loads.</li>
      </DocList>

      <DocH3>Code Blocks in Quizzes</DocH3>
      <DocP>
        When a quiz question includes a code snippet, the app handles it in two layers:
      </DocP>
      <DocList>
        <li>The <strong>programming language is announced first</strong>, e.g. &ldquo;Code example in JavaScript&rdquo; — so you always know what language you&rsquo;re looking at before the code itself is read.</li>
        <li>The <strong>decorated syntax-highlighted version</strong> (with spans and CSS classes) is hidden from screen readers entirely, so you don&rsquo;t hear a flood of markup noise.</li>
        <li>Instead, a <strong>clean plain-text copy</strong> of the code is provided for screen readers — the same source code, without any decoration.</li>
      </DocList>
      <DocNote>
        Code is read as plain text, not interpreted. Your screen reader will read each line sequentially — use your reader&rsquo;s character-by-character or word-by-word navigation (<strong>Right arrow</strong> in VoiceOver browse mode) to examine specific tokens carefully.
      </DocNote>

      <DocH3>Assignment Comments</DocH3>
      <DocP>
        The comments thread on each assignment is fully accessible:
      </DocP>
      <DocList>
        <li>The comment list is announced as a list with item count, so you know how many comments exist before navigating into them.</li>
        <li>Each comment includes the author&rsquo;s name, their role (Staff or student), and the timestamp — all read as part of the comment.</li>
        <li>The comment input has a proper label (&ldquo;Add a comment for your instructor&rdquo; or &ldquo;Leave a comment for the student&rdquo;) so it is clearly identified when you tab to it.</li>
        <li>If you try to send a comment before your assignment is submitted, a message explains why the Send button is disabled.</li>
        <li>Errors (e.g. a network failure while saving) are announced immediately via a live alert region.</li>
        <li>You can submit a comment with <strong>Ctrl + Enter</strong> (or <strong>Cmd + Enter</strong> on Mac) from inside the text box — no need to reach for the button.</li>
      </DocList>

      <DocH2>Keyboard Navigation</DocH2>
      <DocP>
        Every feature in the app is accessible without a mouse. Common keyboard shortcuts:
      </DocP>
      <DocList>
        <li><strong>Tab</strong> — move forward through interactive elements (links, buttons, inputs)</li>
        <li><strong>Shift + Tab</strong> — move backward</li>
        <li><strong>Enter / Space</strong> — activate buttons and links</li>
        <li><strong>Escape</strong> — close dialogs, cancel edits</li>
        <li><strong>Arrow keys</strong> — navigate radio button groups (e.g. quiz answer choices)</li>
        <li><strong>Ctrl + Enter</strong> (or <strong>Cmd + Enter</strong> on Mac) — submit a comment from the comment text box</li>
      </DocList>

      <DocH3>Skip to Main Content</DocH3>
      <DocP>
        Press <strong>Tab</strong> immediately after loading any page and a &ldquo;Skip to main content&rdquo; link will appear at the top of the screen. Pressing <strong>Enter</strong> jumps your focus directly to the page content, bypassing the navigation bar.
      </DocP>

      <DocH2>Reduced Motion</DocH2>
      <DocP>
        If your operating system is set to reduce motion (available in macOS, Windows, iOS, and Android accessibility settings), all animations and transitions in the app are automatically disabled. No in-app setting is needed — the app respects your OS preference.
      </DocP>

      <DocH2>Text Size</DocH2>
      <DocP>
        The app uses your browser&rsquo;s base font size. If you increase text size in your browser settings (e.g. Chrome: Settings → Appearance → Font size), the app will scale accordingly. You can also use your browser&rsquo;s built-in zoom (<strong>Cmd/Ctrl + Plus</strong>) on any page.
      </DocP>

      <DocTip>
        All display settings (dark mode, high contrast, dyslexia font) are found in one place:{' '}
        <Link href="/account" className="text-teal-primary hover:underline">Profile → Display &amp; Appearance</Link>.
      </DocTip>
    </>
  )
}
