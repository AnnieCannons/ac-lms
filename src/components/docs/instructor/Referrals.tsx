import { DocH2, DocH3, DocP, DocList, DocTip, DocNote, DocStep, DocCode } from '@/components/docs/DocComponents'

export default function Referrals() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Referrals &amp; Ratings</h1>
      <p className="text-sm text-muted-text mb-8">
        Log outbound referrals to partner organizations, invite students to rate their experience,
        and track feedback over time.
      </p>

      <DocNote>
        The Referrals dashboard is only visible to <strong>Staff</strong> and <strong>Admins</strong>.
      </DocNote>

      {/* ── Overview ── */}
      <DocH2>What Are Referrals?</DocH2>
      <DocP>
        A referral is a record of a student being sent to an external partner organization for
        support — for example, housing assistance, mental health services, or job placement help.
        Logging a referral lets the team track outcomes, send automated follow-up reminders, and
        collect student ratings for each partner.
      </DocP>

      {/* ── Logging ── */}
      <DocH2>Logging a Referral</DocH2>
      <DocStep number={1}>
        Go to <strong>Partnerships → Referrals</strong> (or open a specific partner and switch to
        the <strong>Referrals</strong> tab).
      </DocStep>
      <DocStep number={2}>Click <strong>+ Log Referral</strong>.</DocStep>
      <DocStep number={3}>Fill in the referral form:</DocStep>
      <DocList>
        <li><strong>Student</strong> — search by name to select the student being referred</li>
        <li><strong>Partner</strong> — the organization the student is being referred to</li>
        <li><strong>Service categories</strong> — one or more types of support being requested (e.g., Housing, Mental Health)</li>
        <li><strong>Referral date</strong> — defaults to today; change it if logging a past referral</li>
        <li><strong>Notes</strong> — optional internal notes visible only to staff and admins</li>
      </DocList>
      <DocStep number={4}>Click <strong>Log Referral</strong> to save.</DocStep>
      <DocTip>
        The student&apos;s current course is auto-filled based on their enrollment. You can change it
        if needed.
      </DocTip>

      {/* ── Rating Invites ── */}
      <DocH2>Sending a Rating Invite</DocH2>
      <DocP>
        After a referral is logged, you can invite the student to rate their experience. The invite
        sends an email with a link to a short star-rating form.
      </DocP>
      <DocStep number={1}>
        Find the referral in the <strong>Referrals</strong> list and click <strong>Send Rating Invite</strong>.
      </DocStep>
      <DocStep number={2}>
        If the referral date is more than 60 days ago, the invite is sent immediately. Otherwise,
        the system schedules it to send 60 days after the referral date so the student has time to
        experience the service first.
      </DocStep>
      <DocP>
        A confirmation banner appears showing whether the invite was sent right away or scheduled.
        The <strong>Rating Invite Sent</strong> column in the list updates to show the date.
      </DocP>
      <DocTip>
        You can send a rating invite more than once (for example, if the student didn&apos;t respond),
        but duplicate ratings are tracked separately.
      </DocTip>

      {/* ── Student Rating Form ── */}
      <DocH2>How the Student Rating Form Works</DocH2>
      <DocP>
        The student receives an email with a private link. When they open it:
      </DocP>
      <DocList>
        <li>They see the partner name and service categories from the referral</li>
        <li>They rate each service on a 1–5 star scale (Not helpful → Excellent)</li>
        <li>They can add optional comments for each service</li>
        <li>They can add ratings for additional services they received</li>
        <li>Once submitted, the form shows a thank-you screen with a link back to their courses</li>
      </DocList>
      <DocNote>
        The rating link is tied to the specific referral and student — it cannot be used by anyone else.
        If a student visits a link for a referral they&apos;ve already rated, they see the thank-you screen
        immediately.
      </DocNote>

      {/* ── Staff Notification ── */}
      <DocH2>Staff Notifications (Slack)</DocH2>
      <DocP>
        When a student submits a rating, the system sends an automatic Slack DM to the designated
        staff contact. The message includes the student&apos;s name, the partner name, the service
        category, and the star score.
      </DocP>
      <DocP>
        Similarly, when a referral is logged and a rating invite is sent, the staff contact receives
        a Slack message confirming it.
      </DocP>

      <DocH3>Changing the Slack Notification Recipient</DocH3>
      <DocP>
        The Slack recipient is set via an environment variable called <DocCode>STAFF_NOTIFY_EMAIL</DocCode>.
        It currently contains the email address of the staff member who should receive these pings.
        To change it:
      </DocP>
      <DocStep number={1}>
        Log in to the <strong>Vercel dashboard</strong> at{' '}
        <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-teal-primary underline">
          vercel.com
        </a>{' '}
        and open the <strong>ac-lms</strong> project.
      </DocStep>
      <DocStep number={2}>
        Go to <strong>Settings → Environment Variables</strong>.
      </DocStep>
      <DocStep number={3}>
        Find the variable named <DocCode>STAFF_NOTIFY_EMAIL</DocCode> and click the pencil icon to edit it.
      </DocStep>
      <DocStep number={4}>
        Replace the current email address with the new staff member&apos;s work email address —
        it must be the same email they use to log in to Slack.
      </DocStep>
      <DocStep number={5}>
        Click <strong>Save</strong>, then go to <strong>Deployments</strong> and
        click <strong>Redeploy</strong> on the most recent production deployment so the new value
        takes effect.
      </DocStep>
      <DocNote>
        The new recipient must be a member of the AnnieCannons Slack workspace. If the email
        doesn&apos;t match a Slack account, the notification will silently fail. Double-check the
        email by asking the person what email they used to join Slack.
      </DocNote>
      <DocTip>
        After updating, log a test referral and submit a rating to confirm the new person receives
        the Slack DM before the old contact is off-boarded.
      </DocTip>

      {/* ── Viewing Ratings ── */}
      <DocH2>Viewing Ratings</DocH2>
      <DocH3>On the Partner Overview Page</DocH3>
      <DocP>
        Open any partner record and look at the <strong>Overview</strong> tab. The
        <strong> Ratings</strong> section shows average star scores broken down by service category,
        with separate rows for student and staff ratings and a count of submissions.
      </DocP>

      <DocH3>On the Referrals Submissions Page</DocH3>
      <DocP>
        Go to <strong>Partnerships → Referrals → Submissions</strong> to see a full log of every
        rating submitted — who submitted it, which partner and service, the score, any comments,
        and the date.
      </DocP>

      {/* ── Staff Ratings ── */}
      <DocH2>Staff Ratings</DocH2>
      <DocP>
        Staff members can also submit ratings for partner organizations directly from the partner
        overview page. Staff ratings are shown separately from student ratings so you can compare
        the two perspectives.
      </DocP>
    </>
  )
}
