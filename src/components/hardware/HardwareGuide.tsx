import Link from 'next/link'
import { DocList, DocNote, DocP, DocStep, DocTip } from '@/components/docs/DocComponents'
import { DocAccordion, type DocAccordionItem } from '@/components/docs/DocAccordion'

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="font-semibold text-teal-primary hover:underline">{children}</Link>
)

const GROUPS: { title: string; items: DocAccordionItem[] }[] = [
  {
    title: 'Equipment coming in',
    items: [
      {
        id: 'bulk-purchase',
        title: 'Have a new bulk purchase?',
        content: (
          <>
            <DocP>Add the whole order at once — you don&apos;t have to enter devices one by one.</DocP>
            <DocStep number={1}>Go to <A href="/instructor/hardware/purchases/new">Devices → + Add a purchase</A>.</DocStep>
            <DocStep number={2}>Choose the type (Laptop, Hotspot or Wifi booster).</DocStep>
            <DocStep number={3}>Fill in what the whole order shares: make and model (e.g. MacBook Pro 13-inch), year, condition, vendor, purchase date and cost per device.</DocStep>
            <DocStep number={4}>Paste the serial numbers (laptops) or IMEIs (hotspots), <strong>one per line</strong>. Copying a column from a spreadsheet works. For boosters, just enter how many.</DocStep>
            <DocStep number={5}>Click <strong>Review</strong>. It warns you about anything pasted twice or already in the tracker. Then click <strong>Add</strong>.</DocStep>
            <DocStep number={6}>On the purchase page that opens, click <strong>Print labels</strong> and stick each tag on its device.</DocStep>
            <DocTip>Every device gets its tag (LAP-031, HOT-007, BOOST-014…) automatically — you never need to know the last number.</DocTip>
          </>
        ),
      },
      {
        id: 'one-device',
        title: 'Got just one device to add?',
        content: (
          <>
            <DocStep number={1}>Go to <A href="/instructor/hardware/devices/new">Devices → + Add one device</A>.</DocStep>
            <DocStep number={2}>Choose the type, enter its serial number (or IMEI / phone number for a hotspot) and any details you have, then click <strong>Add device</strong>.</DocStep>
            <DocStep number={3}>On its page, click <strong>Print label</strong>.</DocStep>
          </>
        ),
      },
      {
        id: 'labels',
        title: 'How do I print labels?',
        content: (
          <>
            <DocList>
              <li><strong>For a purchase:</strong> open the purchase (from a device&apos;s Details → Purchased link) and click <strong>Print labels</strong>.</li>
              <li><strong>For one device:</strong> <strong>Print label</strong> at the top of its page.</li>
              <li><strong>For any set:</strong> on <A href="/instructor/hardware">Devices</A>, tick the ones you want and click <strong>Print labels for N selected</strong>. For a whole type, filter first (e.g. Type: Wifi booster) and click <strong>Print labels for all shown</strong>.</li>
            </DocList>
            <DocP>
              Use 1&quot; × 2-5/8&quot;, 30-per-sheet labels (Avery 5160 for laser printers, 8160 for inkjet, or a compatible
              brand). Print at <strong>100% / Actual size</strong>. Partly used sheet? Pick &ldquo;Start at label #&rdquo;.
            </DocP>
          </>
        ),
      },
    ],
  },
  {
    title: 'Students joining, pausing and leaving',
    items: [
      {
        id: 'give-device',
        title: 'Need to give a student a laptop, hotspot or booster?',
        content: (
          <>
            <DocStep number={1}>Go to <A href="/instructor/hardware?tab=students">Students</A> and click the student.</DocStep>
            <DocStep number={2}>In <strong>Has now</strong>, click <strong>Loan a device</strong>.</DocStep>
            <DocStep number={3}>Pick an in-stock device, add a note if you like (e.g. the tracking number), and click <strong>Loan</strong>.</DocStep>
            <DocP>
              Or start from the device: open it and set <strong>Status → On loan (choose a student)</strong>. Anyone on the
              waitlist for that type shows up as a quick pick.
            </DocP>
          </>
        ),
      },
      {
        id: 'none-in-stock',
        title: 'Student needs something but nothing is in stock?',
        content: (
          <>
            <DocStep number={1}>Go to <A href="/instructor/hardware?tab=waitlist">Waitlist</A> → <strong>+ Add someone</strong>.</DocStep>
            <DocStep number={2}>Pick the student and what they need, add a note if useful, and save.</DocStep>
            <DocP>When one comes in, loan it to them (see above). They come off the waitlist automatically.</DocP>
          </>
        ),
      },
      {
        id: 'paused-or-left',
        title: 'What if a student pauses or leaves the program?',
        content: (
          <>
            <DocStep number={1}>On the course&apos;s <strong>Users</strong> page:
              <ul className="list-disc pl-5 mt-1">
                <li><strong>Paused</strong> (on leave, may come back) → change their role to <strong>Observer</strong>.</li>
                <li><strong>Left the program</strong> → remove them (trash icon), or change them to Observer.</li>
              </ul>
            </DocStep>
            <DocStep number={2}>If they have equipment on loan, a box pops up listing it.</DocStep>
            <DocStep number={3}>Decide:
              <ul className="list-disc pl-5 mt-1">
                <li><strong>They&apos;re keeping it for now</strong> (paused, planning to come back) → click <strong>Not now</strong>. Nothing changes.</li>
                <li><strong>We need it back</strong> → leave everything ticked and click <strong>Mark awaiting return</strong>.</li>
              </ul>
            </DocStep>
            <DocP>
              Once it&apos;s awaiting return, they get a reminder with return instructions 48 hours later, again 5 days after
              that, then weekly until it arrives. You can see everything you&apos;re waiting on under{' '}
              <A href="/instructor/hardware?tab=attention">Needs attention</A>.
            </DocP>
            <DocTip>
              Missed the box, or decided later? Open the student under <A href="/instructor/hardware?tab=students">Students</A>{' '}
              and click <strong>Mark all awaiting return</strong>. If a paused student comes back after you&apos;d asked for it,
              open the device and set <strong>Status → Back on loan (no longer needed back)</strong>; the reminders stop.
            </DocTip>
          </>
        ),
      },
      {
        id: 'graduated',
        title: 'Student finished TCF and ITP — does the laptop become theirs?',
        content: (
          <>
            <DocStep number={1}>On each course&apos;s <strong>Users</strong> page (their Tech Career Foundations course and their Intro to Programming course), tick <strong>Completed</strong> next to their name.</DocStep>
            <DocStep number={2}>Go to <A href="/instructor/hardware?tab=attention">Needs attention</A>. They now show under <strong>Ready to transfer</strong>.</DocStep>
            <DocStep number={3}>Click <strong>Transfer ownership</strong> and confirm. The laptop is now theirs.</DocStep>
            <DocNote>Hotspots and boosters are always on loan — ask for those back when they finish (see &ldquo;pauses or leaves the program&rdquo; above).</DocNote>
          </>
        ),
      },
    ],
  },
  {
    title: 'Getting equipment back',
    items: [
      {
        id: 'box-arrived',
        title: 'A box just arrived — what do I do?',
        content: (
          <>
            <DocStep number={1}>Click <A href="/instructor/hardware/receive">Mark received</A> in the Hardware bar.</DocStep>
            <DocStep number={2}>Click the student in <strong>We&apos;re waiting on</strong>, or search for whoever sent it.</DocStep>
            <DocStep number={3}>Tick what was in the box, add notes about its condition, and choose what happens next:
              <ul className="list-disc pl-5 mt-1">
                <li><strong>Needs prep</strong> — wipe and check it before the next student (most laptops).</li>
                <li><strong>In stock</strong> — ready to go out again as is.</li>
                <li><strong>Needs repair</strong> — something&apos;s wrong with it.</li>
              </ul>
            </DocStep>
            <DocStep number={4}>Click <strong>Mark received</strong>. The reminders to the student stop.</DocStep>
          </>
        ),
      },
      {
        id: 'prep',
        title: 'Finished wiping and checking a returned laptop?',
        content: (
          <>
            <DocStep number={1}>Go to <A href="/instructor/hardware?tab=attention">Needs attention → Needs prep</A>.</DocStep>
            <DocStep number={2}>Click <strong>Wiped and checked</strong> next to it. It&apos;s back in stock, ready for the next student.</DocStep>
          </>
        ),
      },
      {
        id: 'not-back',
        title: "Something still hasn't come back after 60 days?",
        content: (
          <>
            <DocP>
              It shows in red under <strong>Likely lost</strong> on <A href="/instructor/hardware?tab=attention">Needs attention</A>,
              and is posted once in #student-hardware.
            </DocP>
            <DocList>
              <li>Gave up on it → click <strong>Confirm lost</strong>.</li>
              <li>It turned up → <strong>Mark received</strong> as usual.</li>
            </DocList>
          </>
        ),
      },
    ],
  },
  {
    title: 'Problems and replacements',
    items: [
      {
        id: 'problem',
        title: 'Student reported a problem with their equipment?',
        content: (
          <>
            <DocP>
              When they use the Equipment Support Form, a message appears in #student-hardware with a link to the ticket and
              to the Airtable record (that&apos;s where their shipping address is).
            </DocP>
            <DocStep number={1}>Open the ticket (from Slack, or <A href="/instructor/hardware?tab=attention">Needs attention → Support tickets</A>).</DocStep>
            <DocStep number={2}>If it says the student or device couldn&apos;t be matched, pick them on the ticket.</DocStep>
            <DocStep number={3}>Update the status as you go — In progress, Replacement sent, Resolved — with a note.</DocStep>
            <DocTip>A ticket nobody updates for 2 days is posted again in #student-hardware as a nudge.</DocTip>
          </>
        ),
      },
      {
        id: 'replace',
        title: "Student's laptop or charger needs replacing?",
        content: (
          <>
            <DocStep number={1}>Open the student under <A href="/instructor/hardware?tab=students">Students</A>.</DocStep>
            <DocStep number={2}>In <strong>Replacements</strong>, click <strong>Replace laptop</strong> or <strong>Replace charger</strong>.</DocStep>
            <DocStep number={3}>For a laptop, pick the broken one and an in-stock laptop to send. Say whether the old one is being sent back (we&apos;ll chase it) or isn&apos;t (lost or stolen / damaged beyond repair).</DocStep>
            <DocStep number={4}>Click <strong>Record replacement</strong>.</DocStep>
            <DocNote>Each student gets one laptop and one charger replacement. A second one asks you to note why it&apos;s allowed.</DocNote>
          </>
        ),
      },
    ],
  },
  {
    title: 'Keeping things up to date',
    items: [
      {
        id: 'check-in',
        title: 'Want every student to tell you what equipment they have?',
        content: (
          <>
            <DocStep number={1}>Go to <A href="/instructor/hardware/check-in/new">Check-in → + Send a check-in</A>.</DocStep>
            <DocStep number={2}>Tick the courses (current ones are listed first) and add anyone else by name, like alumni with a hotspot.</DocStep>
            <DocStep number={3}>Click <strong>Send check-in</strong>. Each student gets a Slack message and a bell notification.</DocStep>
            <DocStep number={4}>As answers come in, open the check-in and review each one under <strong>To review</strong>: check what it will add, choose whether a laptop is on loan or already theirs, then <strong>Approve</strong>.</DocStep>
            <DocTip>Use <strong>Remind all</strong> for anyone who hasn&apos;t answered yet.</DocTip>
          </>
        ),
      },
      {
        id: 'hotspot-plan',
        title: 'Hotspot plan coming up for renewal?',
        content: (
          <>
            <DocP>You&apos;ll see it in #student-hardware 45 days ahead, and under <strong>Hotspot renewals</strong> on Needs attention.</DocP>
            <DocStep number={1}>Renew it with Mission Telecom as usual.</DocStep>
            <DocStep number={2}>Open the hotspot and, on its <strong>Plan</strong> card, click <strong>Renew</strong>. The next period is filled in for you — check the dates and cost, then <strong>Save plan</strong>.</DocStep>
            <DocNote>New hotspot with no plan yet? Click <strong>Add plan</strong> on its Plan card so you get the renewal reminder.</DocNote>
          </>
        ),
      },
      {
        id: 'break',
        title: "It's a trimester break — what should I check?",
        content: (
          <>
            <DocP>On the first day of each break, #student-hardware gets a reminder. Then:</DocP>
            <DocStep number={1}>Tick <strong>Completed</strong> for everyone who finished their course (on each course&apos;s Users page).</DocStep>
            <DocStep number={2}>Transfer laptops from <strong>Ready to transfer</strong> on <A href="/instructor/hardware?tab=attention">Needs attention</A>.</DocStep>
            <DocStep number={3}>For anyone who graduated or left, mark their hotspots, boosters and loaned laptops <strong>awaiting return</strong>.</DocStep>
          </>
        ),
      },
    ],
  },
]

/** The step-by-step "How do I…?" guide: common situations as questions, each with numbered steps. */
export default function HardwareGuide() {
  return (
    <div className="flex flex-col gap-8">
      {GROUPS.map(g => (
        <section key={g.title}>
          <h2 className="text-sm font-bold text-muted-text uppercase tracking-widest mb-3">{g.title}</h2>
          <DocAccordion items={g.items} defaultOpen={false} />
        </section>
      ))}
    </div>
  )
}
