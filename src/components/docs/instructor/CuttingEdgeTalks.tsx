import { DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'
import { DocAccordion, type DocAccordionItem } from '@/components/docs/DocAccordion'

export default function CuttingEdgeTalks() {
  const items: DocAccordionItem[] = [
    {
      id: 'overview',
      title: 'What Are Cutting Edge Talks?',
      content: (
        <>
          <DocP>
            Cutting Edge Talks are guest-speaker events shared by every class. Each talk is created <strong>once</strong>,
            in one place, and shows up for students in every class it&apos;s for — there&apos;s no copy per course to keep
            in sync.
          </DocP>
          <DocP>
            Open it from <strong>Global Templates → Cutting Edge Talks</strong> in the sidebar. Instructors, staff and
            admins can create, edit, publish and delete talks. TAs see a <strong>Cutting Edge Talks</strong> link in their
            course sidebar and can view everything, read-only.
          </DocP>
          <DocP>Every talk comes with two checkbox assignments for students:</DocP>
          <DocList>
            <li><strong>💬 Submit Your Question in Advance</strong> — required for students who RSVP yes, due before the talk.</li>
            <li><strong>🌉 Say Thank You &amp; Build Bridges</strong> — required after the talk for students who RSVP&apos;d yes, with an &ldquo;I did not make it&rdquo; option.</li>
          </DocList>
          <DocNote>
            These are <strong>not</strong> course assignments. They never appear in a course&apos;s gradebook, assignment
            list, missing/late counts or readiness score. Track them on the Cutting Edge Talks pages instead.
          </DocNote>
          <DocNote>
            The older &ldquo;Upcoming Cutting Edge Talks&rdquo; modules inside individual courses are separate and were left
            as they were.
          </DocNote>
        </>
      ),
    },
    {
      id: 'creating',
      title: 'Creating a Talk',
      content: (
        <>
          <DocStep number={1}>On the Cutting Edge Talks page, click <strong>+ New event</strong>.</DocStep>
          <DocStep number={2}>Fill in the required fields (marked with a red <strong>*</strong>): title, speaker, date, start time, where, and both due dates.</DocStep>
          <DocStep number={3}>Optionally add the join link, a <strong>Block</strong> (A–D), and an <strong>About</strong> description.</DocStep>
          <DocStep number={4}>Choose who it&apos;s for, check the two assignments, then click <strong>Save as draft</strong>.</DocStep>

          <DocH3>Date and time</DocH3>
          <DocP>
            Enter the start time in <strong>your own</strong> timezone — the form shows which one it&apos;s using. Everyone
            who views the talk sees the time converted to their own local timezone.
          </DocP>
          <DocP>
            <strong>Block</strong> is just a label (&ldquo;Block B&rdquo;) shown next to the time. It doesn&apos;t change the
            time or who&apos;s invited.
          </DocP>

          <DocH3>Who it&apos;s for</DocH3>
          <DocList>
            <li><strong>Everyone</strong> (the default) — every student in a class that&apos;s running on the day of the talk.</li>
            <li><strong>Only specific classes</strong> — tick the classes it&apos;s for, e.g. an apprentices-only talk.</li>
          </DocList>

          <DocH3>The two assignments</DocH3>
          <DocP>
            Both start from the standard wording, which you can edit per talk. Each one needs <strong>its own Padlet
            link</strong> — every speaker has a different Padlet. You can save without them and add them later; until
            you do, the talk shows an amber <strong>Padlet link missing</strong> label.
          </DocP>
          <DocP>
            Due dates default to <strong>7 days before</strong> the talk (question) and <strong>7 days after</strong> it
            (thank-you), and follow the event date until you change them. Due dates are Pacific calendar days.
          </DocP>
        </>
      ),
    },
    {
      id: 'publishing',
      title: 'Publishing, Editing and Deleting',
      content: (
        <>
          <DocP>
            New talks are <strong>drafts</strong>: students can&apos;t see them, and an amber banner at the top of the talk
            says so. When it&apos;s ready, click <strong>Publish</strong>.
          </DocP>
          <DocP>
            The first time you publish, you choose whether to <strong>notify</strong> the audience. Checked (the default),
            every student it&apos;s for gets a bell notification and a Slack message asking them to RSVP. Unchecked, the
            talk is published quietly.
          </DocP>
          <DocTip>
            Publish quietly when testing, or when students already know about the talk (for example, one first announced
            in a course module). The RSVP notification can&apos;t be sent later, and republishing never sends it again.
          </DocTip>
          <DocP>
            <strong>Edit</strong> changes the talk for everyone at once. <strong>Unpublish</strong> hides it from students
            again. <strong>Delete</strong> removes it and stops any further reminders.
          </DocP>
        </>
      ),
    },
    {
      id: 'students',
      title: 'What Students See',
      content: (
        <>
          <DocList>
            <li>A <strong>Cutting Edge Talks</strong> item in their course sidebar, listing upcoming and past talks. Past talks stay visible.</li>
            <li>An <strong>RSVP</strong> (Yes / No) they can change any time until the talk starts. Saying yes takes them straight to the question assignment.</li>
            <li>A checkbox on each assignment. After the talk, the thank-you has a second checkbox, <strong>I did not make it</strong> — the two can&apos;t both be checked.</li>
            <li>An orange <strong>Tasks due</strong> badge on the sidebar item while they owe a question or thank-you.</li>
          </DocList>
          <DocNote>
            Previewing a course as a student shows the talks, but RSVPs and checkboxes are turned off.
          </DocNote>
        </>
      ),
    },
    {
      id: 'reminders',
      title: 'Notifications and Reminders',
      content: (
        <>
          <DocP>Every notification is both a bell notification and a Slack message:</DocP>
          <DocList>
            <li><strong>New talk</strong> — when it&apos;s first published (unless published quietly), to everyone it&apos;s for.</li>
            <li><strong>Question reminder</strong> — 8:30am Pacific, 2 days before the question is due, to Yes RSVPs who haven&apos;t checked it off.</li>
            <li><strong>Thank-you reminder</strong> — 8:30am Pacific the morning after the talk, to Yes RSVPs who haven&apos;t thanked or checked &ldquo;I did not make it.&rdquo;</li>
          </DocList>
          <DocP>Nobody gets the same reminder twice, and anyone who has already done the task is skipped.</DocP>
          <DocNote>
            Slack messages find students by their LMS email. If it doesn&apos;t match their Slack account they still get the
            bell notification.
          </DocNote>
        </>
      ),
    },
    {
      id: 'tracking',
      title: 'Tracking RSVPs and Follow-Up',
      content: (
        <>
          <DocP>
            The Cutting Edge Talks page lists every talk with its numbers. Use the <strong>Class</strong> filter to see
            one class at a time. Click a talk for its details and a row per student.
          </DocP>
          <DocList>
            <li><strong>Yes / No / No reply</strong> — RSVPs.</li>
            <li><strong>Question</strong> — students who checked off their question.</li>
            <li><strong>Thanked</strong> — students who checked off their thank-you.</li>
            <li><strong>Missed</strong> (&ldquo;Said yes, didn&apos;t make it&rdquo;) — said yes, then checked &ldquo;I did not make it.&rdquo;</li>
            <li><strong>No follow-up</strong> — said yes, but did neither by the thank-you due date. Shown in red.</li>
          </DocList>
          <DocP>
            Students in more than one class are counted under their most recent one. Anyone who RSVP&apos;d before a talk&apos;s
            audience was narrowed still appears, marked <strong>no longer in audience</strong>.
          </DocP>
          <DocNote>
            The student table is read-only — only students can change their own RSVP and checkboxes.
          </DocNote>
        </>
      ),
    },
  ]

  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Cutting Edge Talks</h1>
      <p className="text-sm text-muted-text mb-8">Create guest-speaker events once for every class, and track RSVPs, questions and thank-yous.</p>

      <DocAccordion items={items} />
    </>
  )
}
