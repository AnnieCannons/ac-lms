import { DocH3, DocP, DocList, DocOL, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'
import { DocAccordion, DocAccordionItem } from '@/components/docs/DocAccordion'

export default function GettingStarted() {
  const items: DocAccordionItem[] = [
    {
      id: 'signing-in',
      title: 'Signing In & Setting Up Your Account',
      content: (
        <>
          <DocP>
            You&apos;ll receive an invite email when you&apos;re enrolled. The link takes you to a &quot;Welcome! Set up
            your account&quot; page where you create your password and activate your account.
          </DocP>
          <DocStep number={1}>Click the invite link in your email.</DocStep>
          <DocStep number={2}>Enter your <strong>First name</strong>.</DocStep>
          <DocStep number={3}>
            Enter a <strong>Password</strong> that meets the requirements shown on the page (see Password Requirements
            below), then re-enter it in <strong>Confirm password</strong> — the page shows &quot;Passwords match&quot; once
            the two entries line up.
          </DocStep>
          <DocStep number={4}>Click <strong>Create account &amp; join course</strong>.</DocStep>
          <DocTip>
            Use the <strong>show/hide password</strong> eye icon next to each password field to reveal what you&apos;ve
            typed as you go.
          </DocTip>
          <DocNote>
            If your link doesn&apos;t work, the page will say &quot;Invalid or expired invite link. Please ask your
            instructor to resend the invitation.&quot; Invite links don&apos;t stay valid forever, so if it&apos;s been a
            while since you were enrolled, ask your instructor for a fresh one.
          </DocNote>

          <DocH3>Logging In After That</DocH3>
          <DocP>
            Once your account is set up, return to the login page any time to sign in with your <strong>Email</strong>{' '}
            and <strong>Password</strong>, then click <strong>Log In</strong>. The same show/hide eye icon is available on
            the password field. Access to AC-LMS is by invitation only — there&apos;s no public sign-up.
          </DocP>

          <DocH3>Forgot Your Password?</DocH3>
          <DocP>You can reset your own password without contacting anyone:</DocP>
          <DocOL>
            <li>On the login page, click <strong>Forgot password?</strong></li>
            <li>Enter your email address and click <strong>Send reset link</strong>.</li>
            <li>Check your inbox for the reset email and click the link in it.</li>
            <li>Set a new password — it must meet the same requirements as when you first created your account.</li>
          </DocOL>
        </>
      ),
    },
    {
      id: 'password-requirements',
      title: 'Password Requirements',
      content: (
        <>
          <DocP>
            Whenever you set a password — during account setup or when resetting a forgotten one — it must meet all of
            the following:
          </DocP>
          <DocList>
            <li>At least <strong>8 characters</strong> long</li>
            <li>At least one <strong>uppercase</strong> letter (A–Z)</li>
            <li>At least one <strong>lowercase</strong> letter (a–z)</li>
            <li>At least one <strong>number</strong> (0–9)</li>
            <li>At least one <strong>symbol</strong> (e.g. !, @, #, $)</li>
          </DocList>
          <DocTip>
            Example of a strong password: <em>Sunrise42!</em> — or use a passphrase like{' '}
            <em>Coffee&amp;Code2026!</em> that&apos;s easy to remember but hard to guess.
          </DocTip>
        </>
      ),
    },
    {
      id: 'course-list',
      title: 'Your Course List',
      content: (
        <>
          <DocP>
            After logging in you land on <strong>My Courses</strong>, showing how many courses you&apos;re enrolled in.
            Every course appears as a card with its name, code, and date range. Courses that are currently running show a
            green <strong>Current</strong> badge and are sorted to the top of the list.
          </DocP>
          <DocStep number={1}>Click a course card, or its <strong>View →</strong> link, to open that course.</DocStep>
          <DocStep number={2}>You&apos;ll land on the <strong>Course Outline</strong> — modules organized by week.</DocStep>
          <DocStep number={3}>Use the left sidebar to move between the other sections of the course.</DocStep>
        </>
      ),
    },
    {
      id: 'sidebar-nav',
      title: 'Sidebar Navigation',
      content: (
        <>
          <DocP>
            Inside a course, the left sidebar gives you quick access to every section. Not all sections are the same for
            every course — your instructor controls what content exists, and a couple of sections simply show &quot;No
            content available yet&quot; until they add something.
          </DocP>

          <DocH3>General</DocH3>
          <DocList>
            <li><strong>General Info</strong> — course description, syllabus, and any course-level information your instructor has shared</li>
          </DocList>

          <DocH3>Course</DocH3>
          <DocList>
            <li><strong>Course Outline</strong> — all weeks and days; the main view of your course content</li>
            <li><strong>Grades</strong> — every assignment in the course with its current status: Not Started, Late, Turned In, Needs Revision, Complete, or Excused</li>
            <li><strong>Quizzes</strong> — published quizzes and your scores</li>
            <li><strong>Class Resources</strong> — videos, readings, links, and files your instructor has attached to the course</li>
            <li><strong>Career Development</strong> — career dev assignments, resources, and quizzes, when your program includes career content</li>
            <li><strong>Level Up Your Skills</strong> — optional bonus assignments you can do for extra practice, when any are available</li>
          </DocList>

          <DocH3>Employment (paid learners)</DocH3>
          <DocP>This group only appears if your course is set up for paid learners.</DocP>
          <DocList>
            <li><strong>Benefits</strong> — information about your employment benefits</li>
            <li><strong>Paid Time Off</strong> — PTO tracking and policies</li>
          </DocList>

          <DocP>
            At the bottom of the sidebar, a <strong>Profile</strong> link takes you to the same account settings page
            described below.
          </DocP>
        </>
      ),
    },
    {
      id: 'top-nav-tools',
      title: 'Top Navigation, Notifications & Tools',
      content: (
        <>
          <DocP>The bar at the top of every page gives you access to account tools and a couple of standalone features:</DocP>
          <DocList>
            <li>The <strong>AC*</strong> logo links back to My Courses</li>
            <li>The bell icon opens your <strong>Notifications</strong> — a dropdown list of recent activity, with an unread count badge; click a notification to jump to the related course or assignment</li>
            <li>The <strong>Help</strong> link opens this documentation</li>
            <li>Your name links to your account settings (see Your Profile &amp; Account Settings below)</li>
            <li>The logout button signs you out</li>
          </DocList>

          <DocH3>Tools</DocH3>
          <DocP>The <strong>Tools</strong> dropdown in the top nav opens features that live outside any single course:</DocP>
          <DocStep number={1}>Click <strong>Tools</strong> in the top navigation bar.</DocStep>
          <DocStep number={2}>Choose <strong>Attendance Portal</strong> to view your own attendance records, <strong>Weekly Readiness</strong> to check in on how ready you feel for the week, or <strong>Flashcard App</strong> to review flashcards — all open inside AC-LMS, not in a separate app.</DocStep>
        </>
      ),
    },
    {
      id: 'profile-account',
      title: 'Your Profile & Account Settings',
      content: (
        <>
          <DocP>
            Click your name in the top navigation bar, or <strong>Profile</strong> at the bottom of a course sidebar, to
            open your account settings.
          </DocP>

          <DocH3>Name</DocH3>
          <DocP>
            Your display name is managed by AnnieCannons staff — the field is read-only, with a note to contact your
            instructor if it needs to be updated.
          </DocP>

          <DocH3>Email Address</DocH3>
          <DocOL>
            <li>Update the email field and click <strong>Update email</strong>.</li>
            <li>A confirmation link is sent to the new address — your email doesn&apos;t actually change until you click it.</li>
          </DocOL>

          <DocH3>Change Password</DocH3>
          <DocOL>
            <li>Enter your <strong>Current password</strong>.</li>
            <li>Enter a <strong>New password</strong> (at least 8 characters) and repeat it in <strong>Confirm new password</strong>.</li>
            <li>Click <strong>Change password</strong>.</li>
          </DocOL>
          <DocTip>
            Use the eye icon on each password field to show or hide what you&apos;re typing. For a password that&apos;s
            hard to guess, follow the same guidelines as Password Requirements above: uppercase, lowercase, a number, and
            a symbol (e.g. <em>MyPassword1!</em>).
          </DocTip>

          <DocH3>Display & Appearance</DocH3>
          <DocP>Below your account details, three accessibility toggles are available:</DocP>
          <DocList>
            <li><strong>Dyslexia-friendly font</strong> — switches to OpenDyslexic, a font designed to improve readability for people with dyslexia</li>
            <li><strong>Dark mode</strong> — switches to a dark color scheme to reduce eye strain in low-light environments</li>
            <li><strong>High contrast</strong> — maximizes contrast throughout the site for easier reading</li>
          </DocList>
        </>
      ),
    },
  ]

  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Getting Started</h1>
      <p className="text-sm text-muted-text mb-8">Welcome to AC-LMS — your online learning platform.</p>

      <DocAccordion items={items} />
    </>
  )
}
