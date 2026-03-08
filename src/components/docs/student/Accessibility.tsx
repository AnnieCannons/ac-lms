import { DocH2, DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'
import Link from 'next/link'

export default function Accessibility() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Accessibility</h1>
      <p className="text-sm text-muted-text mb-8">Customize your display and make the app work better for you.</p>

      <DocH2>Display Settings</DocH2>
      <DocP>
        Three display settings are available under your{' '}
        <Link href="/account" className="text-teal-primary hover:underline">Profile → Accessibility</Link>{' '}
        panel. Changes take effect instantly and are remembered across sessions.
      </DocP>

      <DocH3>Dark Mode</DocH3>
      <DocP>
        Switches to a dark color scheme to reduce eye strain in low-light environments. Recommended for evening studying or anyone who finds bright screens uncomfortable.
      </DocP>
      <DocStep number={1}>Click your name in the top-right corner and select <strong>Profile</strong>.</DocStep>
      <DocStep number={2}>Scroll to the <strong>Accessibility</strong> section.</DocStep>
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

      <DocH2>Keyboard Navigation</DocH2>
      <DocP>
        Every feature in the app is accessible without a mouse. Common keyboard shortcuts:
      </DocP>
      <DocList>
        <li><strong>Tab</strong> — move forward through interactive elements (links, buttons, inputs)</li>
        <li><strong>Shift + Tab</strong> — move backward</li>
        <li><strong>Enter / Space</strong> — activate buttons and links</li>
        <li><strong>Escape</strong> — close dialogs, cancel edits, cancel drag operations</li>
        <li><strong>Arrow keys</strong> — move items during drag-and-drop reordering</li>
      </DocList>

      <DocH3>Skip to Main Content</DocH3>
      <DocP>
        Press <strong>Tab</strong> immediately after loading any page and a &ldquo;Skip to main content&rdquo; link will appear at the top of the screen. Pressing <strong>Enter</strong> jumps your focus directly to the page content, bypassing the navigation bar.
      </DocP>

      <DocH2>Reduced Motion</DocH2>
      <DocP>
        If your operating system is set to reduce motion (available in macOS, Windows, iOS, and Android accessibility settings), all animations and transitions in the app are automatically disabled. No in-app setting is needed — the app respects your OS preference.
      </DocP>

      <DocH2>Screen Readers</DocH2>
      <DocP>
        The app is built for compatibility with screen readers such as VoiceOver (macOS/iOS) and NVDA/JAWS (Windows). Key features:
      </DocP>
      <DocList>
        <li>All buttons and icons have descriptive labels read aloud by screen readers</li>
        <li>Dialogs and modals announce themselves and keep focus contained inside</li>
        <li>Save confirmations, errors, and status updates are announced automatically — no need to navigate to find them</li>
        <li>Status badges (Complete, Needs Revision, Turned In) always include visible text, not just color</li>
        <li>Page navigation is announced when the route changes</li>
      </DocList>

      <DocH2>Text Size</DocH2>
      <DocP>
        The app uses your browser&rsquo;s base font size. If you increase text size in your browser settings (e.g. Chrome: Settings → Appearance → Font size), the app will scale accordingly. You can also use your browser&rsquo;s built-in zoom (<strong>Cmd/Ctrl + Plus</strong>) on any page.
      </DocP>

      <DocTip>
        All accessibility settings (dark mode, high contrast, dyslexia font) are found in one place:{' '}
        <Link href="/account" className="text-teal-primary hover:underline">Profile → Accessibility</Link>.
      </DocTip>
    </>
  )
}
