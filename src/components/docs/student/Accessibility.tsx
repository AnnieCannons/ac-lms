import { DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'
import { DocAccordion } from '@/components/docs/DocAccordion'
import Link from 'next/link'

export default function Accessibility() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Accessibility</h1>
      <p className="text-sm text-muted-text mb-8">Display settings, screen reader support, keyboard navigation, and other tools to make the app work better for you.</p>

      <DocAccordion
        items={[
          {
            id: 'display',
            title: 'Display & Text Settings',
            content: (
              <>
                <DocP>
                  Three display settings live under your{' '}
                  <Link href="/account" className="text-teal-primary hover:underline">Profile → Display &amp; Appearance</Link>{' '}
                  panel. Changes apply instantly and are remembered the next time you log in.
                </DocP>
                <DocStep number={1}>Click your name in the top-right corner of any page. (On a phone or narrow screen, tap the menu icon first, then tap your name.)</DocStep>
                <DocStep number={2}>On the Profile page, scroll down to the <strong>Display &amp; Appearance</strong> panel.</DocStep>
                <DocStep number={3}>Toggle <strong>Dyslexia-friendly font</strong>, <strong>Dark mode</strong>, or <strong>High contrast</strong> on or off.</DocStep>

                <DocH3>Dyslexia-Friendly Font</DocH3>
                <DocP>
                  Switches the entire site to <strong>OpenDyslexic</strong>, a typeface designed to improve readability for people with dyslexia.
                </DocP>
                <DocTip>
                  The dyslexia-friendly font is independent of the other two settings — turn it on with or without Dark mode or High contrast.
                </DocTip>

                <DocH3>Dark Mode</DocH3>
                <DocP>
                  Switches to a dark color scheme to reduce eye strain in low-light environments.
                </DocP>

                <DocH3>High Contrast</DocH3>
                <DocP>
                  Maximizes contrast throughout the site for easier reading — deeper borders, near-black text on white (or near-white text on near-black, if Dark mode is also on), and stronger accent colors.
                </DocP>
                <DocNote>
                  High contrast and Dark mode are independent toggles, not either/or — turn on both together for a low-light, maximum-contrast look. It doesn&rsquo;t matter which one you switch on first; the combination looks the same either way.
                </DocNote>

                <DocH3>Text Size</DocH3>
                <DocP>
                  AC-LMS uses a larger base text size across the whole site for readability, well above the usual browser default. Because that size is fixed in the app&rsquo;s own stylesheet, your browser&rsquo;s font-size preference (e.g. Chrome&rsquo;s Settings → Appearance → Font size) won&rsquo;t make it any bigger.
                </DocP>
                <DocP>
                  To enlarge everything on the page, use your browser&rsquo;s zoom instead: <strong>Cmd/Ctrl + Plus</strong> to zoom in, <strong>Cmd/Ctrl + Minus</strong> to zoom out. Zoom works on every page and scales the whole layout, not just text.
                </DocP>

                <DocH3>Reduced Motion</DocH3>
                <DocP>
                  If your operating system is set to reduce motion (available in macOS, Windows, iOS, and Android accessibility settings), all animations and transitions in the app are automatically disabled. There&rsquo;s no separate in-app setting for this — the app simply respects your OS preference.
                </DocP>
              </>
            ),
          },
          {
            id: 'screen-readers',
            title: 'Screen Reader Support',
            content: (
              <>
                <DocP>
                  The app is built for compatibility with screen readers including <strong>VoiceOver</strong> (macOS and iOS), <strong>NVDA</strong> and <strong>JAWS</strong> (Windows), and <strong>TalkBack</strong> (Android). The sections below describe how specific parts of the app behave with a screen reader.
                </DocP>

                <DocH3>General</DocH3>
                <DocList>
                  <li>All buttons and icon-only controls have descriptive labels read aloud — no icon is left unlabeled.</li>
                  <li>Status badges (<strong>Complete</strong>, <strong>Turned In</strong>, <strong>Needs Revision</strong>, <strong>Late</strong>, <strong>Not Started</strong>) always include visible text, not just color or symbols.</li>
                  <li>Decorative arrows and checkmarks (→, ✓, ✗) are hidden from screen readers; meaningful text like &ldquo;Correct&rdquo; or &ldquo;Incorrect&rdquo; is read instead.</li>
                  <li>Error messages and save confirmations are announced automatically through live regions — you don&rsquo;t need to hunt for them.</li>
                  <li>When you navigate to a new page, keyboard focus moves to the page&rsquo;s main content automatically, so your screen reader announces the new page instead of staying on the link you just clicked.</li>
                  <li>Timestamps throughout the app (comment dates, submission times) use proper semantic time markup so screen readers announce them accurately.</li>
                </DocList>

                <DocH3>Taking a Quiz</DocH3>
                <DocList>
                  <li>Each question is marked up as a labeled group, e.g. &ldquo;Question 3, group&rdquo; — you can jump between questions using your screen reader&rsquo;s group or landmark navigation.</li>
                  <li><strong>Answer choices</strong> are a standard radio button group. Use arrow keys to move between choices within a question, and Tab to move to the next question.</li>
                  <li><strong>Retake mode:</strong> questions you already answered correctly are announced as &ldquo;Question N, already correct&rdquo; and are read-only. Only the questions you still need to redo are interactive.</li>
                  <li><strong>Results:</strong> after you submit, each question in the breakdown is announced as &ldquo;Correct.&rdquo; or &ldquo;Incorrect.&rdquo; before the question text — no need to interpret the ✓/✗ icon or its color.</li>
                  <li><strong>Score card:</strong> your score is presented as a status region, so it&rsquo;s read aloud as soon as the results page loads.</li>
                </DocList>

                <DocH3>Code Blocks in Quizzes</DocH3>
                <DocP>
                  When a quiz question or answer choice includes a code snippet, the app handles it in two layers:
                </DocP>
                <DocList>
                  <li>The <strong>programming language is announced first</strong>, e.g. &ldquo;Code example in JavaScript&rdquo; — so you always know what you&rsquo;re about to hear before the code itself is read.</li>
                  <li>The <strong>syntax-highlighted version</strong> (with decorative colored spans) is hidden from screen readers entirely, so you don&rsquo;t hear a flood of markup noise.</li>
                  <li>Instead, a <strong>clean plain-text copy</strong> of the same code is provided for screen readers.</li>
                </DocList>
                <DocNote>
                  Code is read as plain text, not interpreted. Use your reader&rsquo;s character-by-character or word-by-word navigation (<strong>Right arrow</strong> in VoiceOver browse mode) to examine specific tokens carefully.
                </DocNote>

                <DocH3>Assignment Comments</DocH3>
                <DocP>
                  The comment thread on a submission is accessible whether you&rsquo;re a student, TA, or instructor:
                </DocP>
                <DocStep number={1}>Open a submission and scroll to the <strong>Comments</strong> section.</DocStep>
                <DocStep number={2}>
                  Type into the comment box. If you&rsquo;re a student, it&rsquo;s a plain text box with a hidden label announced as &ldquo;Add a comment for your instructor.&rdquo; If you&rsquo;re an instructor or TA, it&rsquo;s a rich text editor with a &ldquo;Text formatting&rdquo; toolbar (bold, italic, headings, lists, quotes, code, and links), showing the placeholder text &ldquo;Leave a comment for the student&rdquo; until you start typing.
                </DocStep>
                <DocStep number={3}>
                  Click <strong>Save Comment</strong>. If you&rsquo;re a student typing in the plain text box, you can also press <strong>Ctrl + Enter</strong> (<strong>Cmd + Enter</strong> on Mac) instead of reaching for the button — that shortcut isn&rsquo;t available in the rich text editor used by instructors and TAs.
                </DocStep>
                <DocNote>
                  The student comment box has a real, programmatic label, so a screen reader announces &ldquo;Add a comment for your instructor&rdquo; as soon as you tab into it. The instructor/TA rich text editor only shows its placeholder text visually — it has no equivalent programmatic label, so a screen reader announces nothing until you start typing.
                </DocNote>
                <DocList>
                  <li>The comment thread is a semantic list, so your screen reader announces how many comments there are before you navigate into them.</li>
                  <li>Each comment includes the author&rsquo;s name and timestamp; comments from instructors and admins also get a spoken &ldquo;(Staff)&rdquo; tag.</li>
                  <li>If your assignment isn&rsquo;t submitted yet, a message next to the disabled button explains why: &ldquo;Submit your assignment to enable comments.&rdquo; (or, once you&rsquo;ve started typing, &ldquo;Submit your assignment first — your comment will be ready to send after.&rdquo;)</li>
                  <li>Errors — like a network failure while saving — are announced immediately through a live alert region.</li>
                </DocList>
              </>
            ),
          },
          {
            id: 'keyboard',
            title: 'Keyboard Navigation',
            content: (
              <>
                <DocP>Every feature in the app is accessible without a mouse. Common shortcuts:</DocP>
                <DocList>
                  <li><strong>Tab</strong> — move forward through interactive elements (links, buttons, inputs)</li>
                  <li><strong>Shift + Tab</strong> — move backward</li>
                  <li><strong>Enter / Space</strong> — activate buttons and links</li>
                  <li><strong>Escape</strong> — close dialogs and popovers, cancel inline edits, cancel a keyboard drag</li>
                  <li><strong>Arrow keys</strong> — move between choices in a quiz question, or move an item during a keyboard drag (see below)</li>
                  <li><strong>Ctrl + Enter</strong> (<strong>Cmd + Enter</strong> on Mac) — submit a comment, from the plain text comment box only</li>
                </DocList>

                <DocH3>Skip to Main Content</DocH3>
                <DocP>
                  Press <strong>Tab</strong> immediately after loading any page and a &ldquo;Skip to main content&rdquo; link appears at the top of the screen. Pressing <strong>Enter</strong> jumps your focus directly to the page content, bypassing the navigation bar.
                </DocP>

                <DocH3>Dialogs and Popovers</DocH3>
                <DocP>
                  Modals (like the course duplication dialog) and popovers (like the calendar date picker) trap keyboard focus inside them while they&rsquo;re open — Tab and Shift+Tab cycle only through the controls in the dialog, never to elements behind it. Press <strong>Escape</strong> to close either one; focus returns to whatever button opened it.
                </DocP>

                <DocH3>Reordering with the Keyboard</DocH3>
                <DocP>
                  If you&rsquo;re an instructor or TA, drag-and-drop reordering in the Course Editor — modules, days, assignments, resources, and quizzes — is fully keyboard-operable. Tab to a drag handle (labeled, for example, &ldquo;Drag module [name]&rdquo;, &ldquo;Drag day [name]&rdquo;, &ldquo;Drag assignment&rdquo;, &ldquo;Drag resource&rdquo;, or &ldquo;Drag quiz&rdquo;), then:
                </DocP>
                <DocList>
                  <li><strong>Space</strong> or <strong>Enter</strong> — pick up the item, or drop it in its new spot</li>
                  <li><strong>Arrow keys</strong> — move the picked-up item to a new position</li>
                  <li><strong>Escape</strong> — cancel the drag and return the item to where it started</li>
                </DocList>
                <DocP>
                  Your screen reader announces each step of the drag — what was picked up, what it&rsquo;s currently over, and where it ends up (or that it was cancelled).
                </DocP>
              </>
            ),
          },
          {
            id: 'standards',
            title: 'Accessibility Standards',
            content: (
              <>
                <DocP>
                  This app is built to conform with <strong>WCAG 2.1 Level AA</strong> — the Web Content Accessibility Guidelines published by the <strong>W3C</strong> (World Wide Web Consortium) and its Web Accessibility Initiative (<strong>WAI</strong>). These are the internationally recognized standards for accessible web content, and Level AA is the benchmark required by most accessibility laws and policies worldwide.
                </DocP>
                <DocP>
                  WCAG 2.1 is organized around four core principles, sometimes called <strong>POUR</strong>:
                </DocP>
                <DocList>
                  <li><strong>Perceivable</strong> — Information must be presentable in ways users can perceive. We implement this through sufficient color contrast ratios (4.5:1 minimum for text), text alternatives for non-text content, and a layout that adapts to your zoom and display preferences.</li>
                  <li><strong>Operable</strong> — The interface must be operable by everyone. We implement this through full keyboard accessibility, no time limits on tasks, skip navigation links, and support for reduced motion via the OS-level preference.</li>
                  <li><strong>Understandable</strong> — Content and controls must be understandable. We implement this through clear button and form labels, consistent navigation, descriptive error messages, and human-readable status announcements.</li>
                  <li><strong>Robust</strong> — Content must be interpreted by a wide range of user agents, including assistive technologies. We implement this through semantic HTML, <strong>WAI-ARIA</strong> roles and attributes, and testing with major screen readers.</li>
                </DocList>
                <DocNote>
                  We regularly audit the app against WCAG 2.1 AA criteria. If you encounter something that feels inaccessible or difficult to use, please let your instructor know so we can investigate and improve it.
                </DocNote>
              </>
            ),
          },
        ]}
      />
    </>
  )
}
