import { DocH3, DocP, DocList, DocOL, DocTip, DocNote, DocStep, DocCode } from '@/components/docs/DocComponents'
import { DocAccordion } from '@/components/docs/DocAccordion'

export default function Referrals() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Referrals &amp; Ratings</h1>
      <p className="text-sm text-muted-text mb-8">
        Log outbound referrals to partner organizations, and track the ratings students and staff
        leave about their experience.
      </p>

      <DocNote>
        Everything on this page is only visible to <strong>Staff</strong> and <strong>Admins</strong> —
        the whole Partnerships area redirects other roles back to the instructor home.
      </DocNote>

      <DocAccordion
        items={[
          {
            id: 'overview',
            title: 'What Are Referrals?',
            content: (
              <>
                <DocP>
                  A referral is a record of a student being sent to an external partner organization for
                  support — for example, housing assistance, mental health services, or job placement help.
                  Logging a referral lets the team track outcomes and, once enough time has passed, collect
                  a rating from the student about how it went.
                </DocP>
                <DocP>
                  Referrals also appear on the partner&apos;s own record: outbound referrals (students AnnieCannons
                  sent out) show up on the partner&apos;s <strong>Student Success</strong> tab, and inbound referrals
                  (students the partner sent to AnnieCannons) show up on the <strong>Admissions</strong> tab.
                </DocP>
              </>
            ),
          },
          {
            id: 'logging',
            title: 'Logging a Referral',
            content: (
              <>
                <DocP>
                  The full referral flow — the one that links a real student account and can later trigger an
                  automatic rating invite — lives on the <strong>Student Referrals</strong> page.
                </DocP>
                <DocStep number={1}>
                  In the Partnerships sidebar, click <strong>Student Referrals</strong>.
                </DocStep>
                <DocStep number={2}>
                  Make sure the <strong>Make a Referral</strong> tab is selected (it&apos;s the default). Under{' '}
                  <strong>Step 1 — Select student</strong>, search by name or email and choose the student.
                </DocStep>
                <DocStep number={3}>
                  Under <strong>Referral details</strong>, set the <strong>Date</strong> (defaults to today) and
                  check the <strong>Current course</strong> field — it auto-fills from the student&apos;s active
                  enrollment but you can edit it.
                </DocStep>
                <DocStep number={4}>
                  Under <strong>Step 2 — Filter by location &amp; services</strong>, optionally narrow the
                  organization list by city/state or by clicking one or more service tags (Housing, Healthcare,
                  Mental Health / Counseling, and so on).
                </DocStep>
                <DocStep number={5}>
                  Under <strong>Step 3 — Select orgs to refer to</strong>, check one or more organization cards.
                  Selecting at least one org opens the <strong>Make Referral</strong> panel below the list.
                </DocStep>
                <DocStep number={6}>
                  In the <strong>Make Referral</strong> panel, tag the <strong>Services needed</strong> and add
                  optional <strong>Notes</strong>.
                </DocStep>
                <DocStep number={7}>
                  Click <strong>Make Referral</strong> (it reads{' '}
                  <strong>Make Referral (N orgs)</strong> if you selected more than one). This logs a separate
                  referral per org and switches you to the <strong>History</strong> tab.
                </DocStep>
                <DocTip>
                  A green &ldquo;Referral logged!&rdquo; banner confirms the save and tells you whether a rating
                  invite went out immediately or will follow automatically once 60 days have passed — see{' '}
                  <strong>How Rating Invites Work</strong> below.
                </DocTip>
                <DocNote>
                  Each partner&apos;s <strong>Student Success</strong> (outbound) and <strong>Admissions</strong>{' '}
                  (inbound) tabs also have a small <strong>Log a Referral</strong> form for quickly noting a
                  student by name. It&apos;s handy for a fast log, but it doesn&apos;t link a real student account,
                  so referrals logged this way never trigger the automatic rating invite described below.
                </DocNote>
              </>
            ),
          },
          {
            id: 'rating-invites',
            title: 'How Rating Invites Work',
            content: (
              <>
                <DocP>
                  There&apos;s no button to send a rating invite — it happens on its own, based on the referral
                  date:
                </DocP>
                <DocList>
                  <li>
                    If the referral date is already 60+ days in the past when you log it, the student is
                    notified right away.
                  </li>
                  <li>
                    Otherwise, a scheduled job runs every night and sends the notification as soon as the
                    referral crosses the 60-day mark.
                  </li>
                  <li>
                    If the student still hasn&apos;t submitted a rating, the same job sends a follow-up reminder
                    7 days and again 14 days after the first notification.
                  </li>
                </DocList>
                <DocNote>
                  The notification is a <strong>Slack direct message</strong>, not an email — it&apos;s sent to
                  whatever Slack account matches the student&apos;s AnnieCannons email address. If the student
                  doesn&apos;t have a matching Slack account, they won&apos;t be reached (email delivery for this
                  flow isn&apos;t wired up yet).
                </DocNote>
                <DocP>
                  A student can only submit one rating per referral per service category — trying again returns
                  &ldquo;You have already submitted a rating for this referral&rdquo;
                </DocP>
              </>
            ),
          },
          {
            id: 'student-form',
            title: 'The Student Rating Form',
            content: (
              <>
                <DocP>
                  The student&apos;s Slack DM links to a private rating page. When they open it:
                </DocP>
                <DocList>
                  <li>They see who they were referred to and which service(s) it was for</li>
                  <li>
                    For each service, they answer <strong>&ldquo;How helpful was this service?&rdquo;</strong> on
                    a 1–5 star scale: Not helpful, Somewhat helpful, Helpful, Very helpful, Excellent
                  </li>
                  <li>They can add optional <strong>Additional comments</strong> for each service</li>
                  <li>
                    Clicking <strong>+ Rate another service</strong> lets them rate additional services they
                    received
                  </li>
                  <li>
                    Clicking <strong>Submit Rating</strong> saves all of it; clicking <strong>Skip</strong>{' '}
                    leaves without rating and returns them to their courses
                  </li>
                  <li>
                    Once submitted, they see a &ldquo;Thank you for your feedback!&rdquo; screen with a{' '}
                    <strong>Back to my courses</strong> button
                  </li>
                </DocList>
                <DocNote>
                  The rating link is tied to the specific referral and student — it cannot be used by anyone
                  else. If a student opens a link for a referral they&apos;ve already rated, they land straight
                  on the thank-you screen.
                </DocNote>
              </>
            ),
          },
          {
            id: 'slack-notifications',
            title: 'Staff Slack Notifications',
            content: (
              <>
                <DocP>
                  Staff get pinged with a Slack DM at two points in the flow: when a rating invite is sent to a
                  student, and again when that student actually submits their rating (the second message includes
                  the student&apos;s name, the partner, the service category, and the star score).
                </DocP>

                <DocH3>Changing the Slack Notification Recipient</DocH3>
                <DocP>
                  The recipient is set by an environment variable/secret named{' '}
                  <DocCode>STAFF_NOTIFY_EMAIL</DocCode>. It&apos;s read in two separate places, so you need to
                  update it in both:
                </DocP>
                <DocOL>
                  <li>The main app (Vercel) — for invites sent the moment a referral is logged.</li>
                  <li>
                    The nightly follow-up job (GitHub Actions) — for the 60-day and 7/14-day reminder sends.
                  </li>
                </DocOL>
                <DocStep number={1}>
                  Log in to the <strong>Vercel dashboard</strong> at{' '}
                  <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-teal-primary underline">
                    vercel.com
                  </a>{' '}
                  and open the <strong>ac-lms</strong> project.
                </DocStep>
                <DocStep number={2}>
                  Go to <strong>Settings → Environment Variables</strong>, find{' '}
                  <DocCode>STAFF_NOTIFY_EMAIL</DocCode>, and edit its value to the new staff member&apos;s work
                  email — it must be the same email they use to log in to Slack.
                </DocStep>
                <DocStep number={3}>
                  Save, then go to <strong>Deployments</strong> and redeploy the most recent production
                  deployment so the new value takes effect.
                </DocStep>
                <DocStep number={4}>
                  In the GitHub repo, go to <strong>Settings → Secrets and variables → Actions</strong> and edit
                  the <DocCode>STAFF_NOTIFY_EMAIL</DocCode> secret to the same value, so the nightly follow-up
                  workflow (<DocCode>Referral Follow-up Emails</DocCode>) pings the right person too.
                </DocStep>
                <DocNote>
                  The new recipient must be a member of the AnnieCannons Slack workspace. If the email
                  doesn&apos;t match a Slack account, the notification silently fails — double-check the email by
                  asking the person what email they used to join Slack.
                </DocNote>
                <DocTip>
                  After updating both, log a test referral with a past date (60+ days ago) and submit a rating
                  to confirm the new person receives the Slack DMs before the old contact is off-boarded.
                </DocTip>
              </>
            ),
          },
          {
            id: 'viewing-ratings',
            title: 'Viewing Ratings',
            content: (
              <>
                <DocH3>On the Partner Overview Page</DocH3>
                <DocP>
                  Open any partner record — the <strong>Overview</strong> tab&apos;s <strong>Ratings</strong>{' '}
                  section shows average star scores broken down by service category, with separate
                  Students/Staff rows and a count of submissions per row. The section only appears once that
                  partner has at least one rating.
                </DocP>

                <DocH3>On the Rating Submissions Page</DocH3>
                <DocP>
                  From the <strong>Student Referrals</strong> page, click <strong>Rating submissions →</strong>{' '}
                  in the top right (or go directly to Partnerships → Student Referrals → Submissions) to see
                  every rating ever submitted, with search by partner, category, or reviewer. The table shows
                  Organization, Category, Score, Reviewer, Type (Student/Staff), Notes, and Date, plus summary
                  counts for Total, Student, and Staff ratings.
                </DocP>
              </>
            ),
          },
          {
            id: 'staff-ratings',
            title: 'Staff Ratings',
            content: (
              <>
                <DocP>
                  The system already tracks a separate <DocCode>staff</DocCode> reviewer type alongside student
                  ratings — it&apos;s what powers the &ldquo;Staff&rdquo; rows and counts in the Ratings section
                  and the Submissions page.
                </DocP>
                <DocNote>
                  There is currently no in-app form for a staff member to submit their own rating of a partner.
                  Until that&apos;s built, every rating you&apos;ll see is a student rating collected through the
                  invite flow above — expect the &ldquo;Staff&rdquo; rows in the Ratings section and Submissions
                  page to read zero or &ldquo;—&rdquo; until that changes.
                </DocNote>
              </>
            ),
          },
        ]}
      />
    </>
  )
}
