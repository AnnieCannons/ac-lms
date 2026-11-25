import { DocH3, DocP, DocList, DocNote, DocStep, DocTip } from '@/components/docs/DocComponents'
import { DocAccordion, type DocAccordionItem } from '@/components/docs/DocAccordion'

export default function Onboarding() {
  const items: DocAccordionItem[] = [
    {
      id: 'setup',
      title: 'Setting up an Enrollment Readiness course',
      content: (
        <>
          <DocP>
            Accepted students start in an <strong>Enrollment Readiness</strong> course. Make the next one by duplicating the last
            one: everything carries over, including the settings below. The only thing that starts empty is the cohort&apos;s
            <strong> Next course</strong>.
          </DocP>
          <DocStep number={1}>
            On the course&apos;s <strong>General Info</strong> page, tick <strong>Enrollment Readiness</strong> (or tick it when
            you create the course).
          </DocStep>
          <DocStep number={2}>
            Invite the accepted students as usual from the course&apos;s <strong>Users</strong> page.
          </DocStep>
          <DocStep number={3}>
            Check which assignments count toward finishing. Every assignment counts unless you switch it to{' '}
            <strong>Doesn&apos;t count toward finishing</strong> in the assignment editor (that button only shows in Enrollment
            Readiness courses). <em>Receiving Your Laptop</em> is set that way, since students do it after the laptop arrives.
          </DocStep>
          <DocP>Students in an Enrollment Readiness course see a shorter sidebar: My Equipment, Course Outline, Grades and Profile.
            They aren&apos;t sent Cutting Edge Talk invites or equipment check-ins until they&apos;re in a class.</DocP>
        </>
      ),
    },
    {
      id: 'finishing',
      title: 'When is a student finished?',
      content: (
        <>
          <DocP>
            A student has finished when <strong>every assignment that counts is marked Complete</strong>. Turning it in isn&apos;t
            enough. Excused assignments don&apos;t count against them, and optional or bonus ones never count.
          </DocP>
          <DocP>The moment they finish:</DocP>
          <DocList>
            <li>their Course Outline shows a congratulations card with Codecademy links to start practicing HTML;</li>
            <li>they&apos;re ticked <strong>Completed</strong> on the course&apos;s Users page;</li>
            <li>they go on the Hardware <strong>Waitlist</strong> for a laptop (unless they have their own) and for a hotspot or booster if that&apos;s their wifi;</li>
            <li>a message posts in <strong>#student-hardware</strong> saying what they need.</li>
          </DocList>
          <DocP>
            Finishing sticks: if you add or unmark work afterwards, they stay finished. To undo it, untick{' '}
            <strong>Completed</strong> on the course&apos;s Users page. Ticking Completed there yourself finishes a student by hand,
            with the same waitlist and Slack steps. Only published assignments count, so publish the whole course before students start.
          </DocP>
          <DocNote>
            The DocuSign is the <em>Equipment Use &amp; Responsibility Agreement</em> assignment. Students submit
            &ldquo;Finished&rdquo;; check DocuSign before you mark it Complete.
          </DocNote>
        </>
      ),
    },
    {
      id: 'page',
      title: 'The New Student Onboarding page',
      content: (
        <>
          <DocP>
            Open it from the <strong>New Student Onboarding</strong> card on the Dashboard. It opens on the cohort that&apos;s running
            (switch cohorts at the top right).
          </DocP>
          <DocList>
            <li><strong>Needs you</strong>: work waiting to be marked Complete, students ready to ship, and Comcast NOW plans to record. Click one to see just those students.</li>
            <li><strong>Invited</strong>: students who haven&apos;t signed in yet (inviting someone adds them to the course straight away).</li>
            <li>Each student shows their progress, what&apos;s overdue, their Laptop and Wifi choices, and where their equipment is.</li>
          </DocList>
          <DocH3>A student&apos;s checklist</DocH3>
          <DocP>
            Click a name (or <strong>Checklist</strong>) to see every assignment, including ones that aren&apos;t due yet, with
            its status. <strong>Mark complete</strong> works for turned-in work and staff check-offs; click an assignment to read
            what they submitted first.
          </DocP>
        </>
      ),
    },
    {
      id: 'equipment',
      title: 'Wifi choices, shipping and Comcast NOW',
      content: (
        <>
          <DocP>
            Every student gets a laptop. After you meet with a student, set their <strong>Wifi</strong> (None, Comcast NOW,
            Booster or Hotspot) on the onboarding page or the student&apos;s Hardware page. Next to it you can see where their laptop
            is: ships once they finish, ready to ship, shipped (with tracking) or arrived.
          </DocP>
          <DocH3>Shipping</DocH3>
          <DocStep number={1}>Buy and print the label on Pirate Ship, and box everything up.</DocStep>
          <DocStep number={2}>
            Click <strong>Ship…</strong> next to the student. Pick the laptop (and hotspot or booster) going in the box, the
            carrier and the tracking number.
          </DocStep>
          <DocStep number={3}>
            Click <strong>Mark shipped</strong>. The devices are loaned to the student, and they get a bell, a Slack DM and an
            email with the tracking link.
          </DocStep>
          <DocP>
            Until then, the student&apos;s My Equipment says &ldquo;We&apos;re preparing to ship your laptop.&rdquo; When it arrives they
            click <strong>I got it</strong>. If they don&apos;t, the box shows on Hardware → Needs attention after a week, and you
            can mark it arrived from their Hardware page. Typo in a tracking number? Use <strong>Fix tracking</strong> there.
          </DocP>
          <DocH3>Comcast NOW</DocH3>
          <DocP>
            Once the plan is set up, record it on the student&apos;s Hardware page (<strong>Set up plan</strong>): the start date is
            the billing day. On that day each month a reminder to get the receipt posts in #student-hardware, tagging you. If a student with a plan is changed to observer, a message there asks you to cancel the card.
          </DocP>
          <DocTip>
            Changing a student&apos;s wifi after they&apos;ve finished updates the Waitlist for you: the new device is added and the old
            one is dropped.
          </DocTip>
        </>
      ),
    },
    {
      id: 'next-course',
      title: 'Moving students into Tech Career Foundations',
      content: (
        <>
          <DocP>
            The Tech Career Foundations course usually doesn&apos;t exist yet while Enrollment Readiness is running. Once it does:
          </DocP>
          <DocStep number={1}>On the onboarding page, choose it under <strong>Next course</strong>.</DocStep>
          <DocStep number={2}>
            Click <strong>Add N finished students</strong>. Everyone who has finished and isn&apos;t in that course yet is added as a
            student. Nobody is added automatically.
          </DocStep>
          <DocP>Students stay in the Enrollment Readiness course afterwards, and show as <strong>Moved on</strong>.</DocP>
        </>
      ),
    },
  ]

  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">New Student Onboarding</h1>
      <p className="text-sm text-muted-text mb-8">
        Enrollment Readiness prework, shipping equipment to new students, and moving them into Tech Career Foundations.
      </p>
      <DocAccordion items={items} />
    </>
  )
}
