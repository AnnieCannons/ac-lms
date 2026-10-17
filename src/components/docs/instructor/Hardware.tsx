import { DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'
import { DocAccordion, type DocAccordionItem } from '@/components/docs/DocAccordion'

export default function Hardware() {
  const items: DocAccordionItem[] = [
    {
      id: 'overview',
      title: 'What the Hardware Tracker Is',
      content: (
        <>
          <DocP>
            The Hardware tracker keeps track of the equipment AnnieCannons gives students: <strong>MacBooks</strong>,{' '}
            <strong>hotspots</strong> (Franklin hotspots from Mission Telecom) and <strong>wifi boosters</strong>. It
            replaces the hardware spreadsheets: who has what, what we&apos;re waiting to get back, when hotspot plans
            renew, and the full history of every device.
          </DocP>
          <DocP>
            Open it from the <strong>Hardware</strong> card on the instructor dashboard. Instructors, staff and admins can
            use it. TAs and students can&apos;t. Every Hardware page has the same bar along the top:
          </DocP>
          <DocList>
            <li><strong>Devices</strong> — every device, with search and filters. Add new equipment here.</li>
            <li><strong>Students</strong> — find a student to see or update their equipment.</li>
            <li><strong>Needs attention</strong> — everything waiting on you, with a count for each kind.</li>
            <li><strong>Waitlist</strong> — students waiting for a device.</li>
            <li><strong>Check-in</strong> — ask students which equipment they have.</li>
            <li><strong>Mark received</strong> — when a box arrives back.</li>
          </DocList>
          <DocNote>
            No shipping addresses are stored in the LMS. They stay in Airtable.
          </DocNote>
        </>
      ),
    },
    {
      id: 'adding',
      title: 'Adding Equipment and Printing Labels',
      content: (
        <>
          <DocH3>A whole purchase</DocH3>
          <DocStep number={1}>On <strong>Devices</strong>, click <strong>+ Add a purchase</strong>.</DocStep>
          <DocStep number={2}>Choose the type, then fill in the details shared by the whole order: make and model, year, condition, vendor, purchase date and cost per device (warranty and notes are optional).</DocStep>
          <DocStep number={3}>Paste the serial numbers (laptops) or IMEIs (hotspots), one per line. A spreadsheet column pastes cleanly. For boosters, which have no serial number, enter how many.</DocStep>
          <DocStep number={4}>Click <strong>Review</strong>. It flags anything pasted twice or already in the tracker before anything is saved. Then click <strong>Add</strong>.</DocStep>
          <DocP>Use <strong>+ Add one device</strong> for an odd one-off.</DocP>

          <DocH3>Tags</DocH3>
          <DocP>
            Every device gets a tag automatically: <strong>LAP-001</strong>, <strong>HOT-001</strong>,{' '}
            <strong>BOOST-001</strong>, counting up for each type. You never have to work out the next number, and tags are
            never reused.
          </DocP>

          <DocH3>Printing labels</DocH3>
          <DocP>
            Print from a purchase&apos;s page (<strong>Print labels</strong>), a device page (<strong>Print label</strong>), or
            the Devices list: tick devices and click <strong>Print labels for N selected</strong>, or filter (for example,
            Type: Wifi booster) and click <strong>Print labels for all shown</strong>.
          </DocP>
          <DocList>
            <li><strong>Labels to buy:</strong> any 1&quot; × 2-5/8&quot;, 30-per-sheet address labels — Avery 5160 (laser), Avery 8160 (inkjet), or Amazon Basics / store brands &ldquo;compatible with Avery 5160.&rdquo; Match your printer type.</li>
            <li><strong>Print settings:</strong> Letter paper, scale <strong>100% / Actual size</strong> (not &ldquo;Fit to page&rdquo;), margins None or Default, headers and footers off.</li>
            <li><strong>Partly used sheet?</strong> Use &ldquo;Start at label #&rdquo; to skip the spots already peeled off.</li>
          </DocList>
          <DocTip>Print one page on plain paper first and hold it against a label sheet. A strip of clear tape over the label helps on devices that travel.</DocTip>
        </>
      ),
    },
    {
      id: 'device-page',
      title: 'The Device Page',
      content: (
        <>
          <DocP>Click any tag to open its device page. From top to bottom:</DocP>
          <DocList>
            <li><strong>Header</strong> — tag, model · year · condition, serial number or IMEI, and who has it.</li>
            <li><strong>Status</strong> — a dropdown that only offers the changes that make sense from where the device is now. Picking one opens the small form it needs; <strong>Cancel</strong> leaves it as it was.</li>
            <li><strong>Plan</strong> (hotspots only) — the Mission Telecom plan and when it renews. See <em>Hotspot Plans and Renewals</em>.</li>
            <li><strong>Details</strong> — serial / IMEI / phone, and the purchase it came from. Click <strong>Edit</strong> to correct anything, including model and year.</li>
            <li><strong>History</strong> — everything that has happened to the device, newest first. <strong>Add note</strong> adds your own.</li>
          </DocList>
          <DocP>The statuses:</DocP>
          <DocList>
            <li><strong>In stock</strong> — on the shelf, ready to go out.</li>
            <li><strong>On loan</strong> — with a student, still ours.</li>
            <li><strong>Owned by student</strong> — a laptop that became theirs.</li>
            <li><strong>Awaiting return</strong> — we&apos;ve asked for it back.</li>
            <li><strong>Needs prep</strong> — came back; wipe and check it before the next student.</li>
            <li><strong>Needs repair</strong>, <strong>Lost</strong>, <strong>Retired</strong>.</li>
          </DocList>
        </>
      ),
    },
    {
      id: 'loans',
      title: 'Loaning Equipment and Getting It Back',
      content: (
        <>
          <DocH3>Giving a device to a student</DocH3>
          <DocList>
            <li><strong>From the student:</strong> Students → pick the student → in <strong>Has now</strong>, click <strong>Loan a device</strong> and choose from what&apos;s in stock.</li>
            <li><strong>From the device:</strong> open an in-stock device and set Status to <strong>On loan (choose a student)</strong>. Anyone on the waitlist for that type shows up as a quick pick.</li>
          </DocList>

          <DocH3>Asking for it back</DocH3>
          <DocP>
            Set the device&apos;s Status to <strong>Awaiting return</strong>, or on the student&apos;s page click{' '}
            <strong>Mark all awaiting return</strong>. The student is reminded automatically (see <em>Reminders and
            Slack</em>), and the device appears under Needs attention with how many days you&apos;ve been waiting. If they
            turn out to still need it, choose <strong>Back on loan (no longer needed back)</strong>.
          </DocP>

          <DocH3>When a box arrives</DocH3>
          <DocStep number={1}>Click <strong>Mark received</strong> in the Hardware bar. The <strong>We&apos;re waiting on</strong> list shows everyone you&apos;ve asked; click their name, or search for whoever sent it.</DocStep>
          <DocStep number={2}>Tick what was in the box (everything they have is ticked to start), add condition notes, and choose what happens next: <strong>Needs prep</strong>, <strong>In stock</strong> or <strong>Needs repair</strong>.</DocStep>
          <DocStep number={3}>Click <strong>Mark received</strong>. A ✓ confirmation shows what changed, with links to the device and to mark something else received.</DocStep>
          <DocP>
            Devices marked <strong>Needs prep</strong> wait under Needs attention until you click{' '}
            <strong>Wiped and checked</strong>, which puts them back in stock.
          </DocP>

          <DocH3>Not coming back</DocH3>
          <DocP>
            After <strong>60 days</strong> awaiting return, a device moves to <strong>Likely lost</strong> on Needs attention
            and is posted once in #student-hardware. Nothing is marked lost automatically: click <strong>Confirm
            lost</strong>, or mark it received if it turns up.
          </DocP>
        </>
      ),
    },
    {
      id: 'leaving',
      title: 'When a Student Leaves or Graduates',
      content: (
        <>
          <DocP>
            On a course&apos;s <strong>Users</strong> page, when you remove a student from the course or change them to{' '}
            <strong>Observer</strong>, the LMS checks whether they have anything on loan. If they do, a dialog lists it
            with <strong>Mark awaiting return</strong> (one click), <strong>Open their hardware page</strong>, and{' '}
            <strong>Not now</strong>. If they&apos;re still a student in another current course (for example, moving on
            from TCF to ITP), it says they probably still need it. The remove or role change itself is never blocked.
          </DocP>
          <DocNote>
            Deleting a student&apos;s account (All Users → trash icon) is refused while they still have loaned equipment
            or an open return. Mark it received or lost first. A laptop they own doesn&apos;t block it.
          </DocNote>
          <DocP>
            On the <strong>first day of each break</strong> (from the PTO page&apos;s break dates; Winter Break and the
            Holiday Break weeks count once), #student-hardware gets a reminder to mark completions and ask for equipment
            back from anyone who left.
          </DocP>
        </>
      ),
    },
    {
      id: 'ownership',
      title: 'Laptop Ownership and Replacements',
      content: (
        <>
          <DocH3>Ready to transfer</DocH3>
          <DocP>
            A loaned laptop becomes the student&apos;s once they&apos;ve completed <strong>both</strong> a Tech Career
            Foundations course and an Intro to Programming course. Mark completion with the <strong>Completed</strong>{' '}
            checkbox on each course&apos;s Users page. The courses are recognized by name: anything starting with
            &ldquo;Tech Career Foundations&rdquo; or &ldquo;Intro to Programming&rdquo; counts.
          </DocP>
          <DocP>
            Those students appear under <strong>Ready to transfer</strong> on Needs attention. Click{' '}
            <strong>Transfer ownership</strong> to make the laptop theirs. Nothing transfers automatically. You can also
            transfer any loaned laptop from its Status dropdown (<strong>Owned by student</strong>).
          </DocP>

          <DocH3>Replacements</DocH3>
          <DocP>
            Each student gets <strong>one laptop replacement and one charger replacement</strong>. The{' '}
            <strong>Replacements</strong> card on their hardware page shows what they&apos;ve used.
          </DocP>
          <DocList>
            <li><strong>Replace laptop</strong> — choose the laptop being replaced and an in-stock laptop to send. Say whether the old one is being sent back (it becomes awaiting return) or isn&apos;t (lost or stolen / damaged beyond repair, with what happened). The new laptop is owned if the old one was.</li>
            <li><strong>Replace charger</strong> — just records it.</li>
            <li>A second replacement of either kind asks you to note why it&apos;s allowed.</li>
          </DocList>
        </>
      ),
    },
    {
      id: 'waitlist',
      title: 'The Waitlist',
      content: (
        <>
          <DocP>
            For students who need a laptop, hotspot or booster when none is free. On <strong>Waitlist</strong>, click{' '}
            <strong>+ Add someone</strong>, pick the student and the type, and add a note if useful. Each type is first come,
            first served.
          </DocP>
          <DocP>
            When you loan a device of that type to someone on the list, they come off it automatically. An in-stock
            device&apos;s loan form shows the people waiting as quick picks. The waitlist is staff-only.
          </DocP>
        </>
      ),
    },
    {
      id: 'check-in',
      title: 'The Equipment Check-In',
      content: (
        <>
          <DocP>
            The check-in asks students which equipment they have, so you can fill in the tracker without typing it all
            yourself. Nothing goes into the tracker until you review each answer.
          </DocP>
          <DocStep number={1}>Open <strong>Check-in</strong> → <strong>+ Send a check-in</strong>.</DocStep>
          <DocStep number={2}>Tick the courses it&apos;s for (current ones are listed first), and add anyone else by name, such as alumni who still have a hotspot or booster.</DocStep>
          <DocStep number={3}>Click <strong>Send check-in</strong>. Each student gets a Slack message and a bell notification, plus a banner on My Courses until they answer.</DocStep>
          <DocP>
            Students give their MacBook serial number, their hotspot&apos;s IMEI and/or phone number, whether they have a
            booster, and any past laptop or charger replacements. The form explains where to find each number. They can
            change their answers until you review them.
          </DocP>

          <DocH3>Reviewing answers</DocH3>
          <DocP>Each answer under <strong>To review</strong> shows what approving would do:</DocP>
          <DocList>
            <li><strong>Add</strong> a new device (with the next tag) and give it to them, or <strong>link</strong> an in-stock device with that serial / IMEI / phone number.</li>
            <li><strong>Already recorded as theirs</strong> — nothing to do.</li>
            <li><strong>In red</strong> — the number matches a device with someone else, or one marked lost or retired. Sort it out on the device page first; approving skips it.</li>
            <li><strong>Past replacement</strong> — records that their laptop or charger was already replaced, so it counts toward their one each.</li>
          </DocList>
          <DocP>
            For a laptop, choose <strong>Laptop is on loan</strong> or <strong>Laptop is already theirs</strong> (anyone who
            finished TCF and ITP before the tracker existed). Untick anything you don&apos;t want, then{' '}
            <strong>Approve</strong>, or <strong>Dismiss</strong> it with a reason.
          </DocP>
          <DocP>
            <strong>Not answered</strong> lists who still owes an answer. <strong>Remind</strong> (one person) and{' '}
            <strong>Remind all</strong> send the Slack message and bell again. <strong>Add people</strong> adds more
            students; <strong>Close check-in</strong> stops it showing to students.
          </DocP>
          <DocNote>
            Devices added from the check-in only have what the student gave you (a serial or IMEI). Fill in make, model
            and year later with <strong>Edit</strong> on the device page.
          </DocNote>
        </>
      ),
    },
    {
      id: 'plans',
      title: 'Hotspot Plans and Renewals',
      content: (
        <>
          <DocP>
            Every hotspot page has a <strong>Plan</strong> card. Click <strong>Add plan</strong> and enter who it&apos;s
            through (Mission Telecom by default), the start and end dates, and optionally the plan name, cost, account and
            line numbers.
          </DocP>
          <DocList>
            <li>The card shows when the plan renews, in red once it&apos;s within <strong>45 days</strong>.</li>
            <li><strong>Renew</strong> fills in the next period (starting when the current one ends, same length and details) for you to save.</li>
            <li><strong>Edit</strong> corrects the current period. Earlier periods are listed underneath.</li>
          </DocList>
          <DocP>
            Needs attention lists <strong>Hotspot renewals</strong> (ending within 45 days, or already ended) and{' '}
            <strong>Hotspots with no plan</strong>. Each plan is also posted once in #student-hardware when it reaches 45
            days.
          </DocP>
        </>
      ),
    },
    {
      id: 'tickets',
      title: 'Support Tickets (Equipment Support Form)',
      content: (
        <>
          <DocP>
            When a student submits the Airtable <strong>Equipment Support Form</strong>, the LMS makes a ticket and posts it
            in #student-hardware: who it&apos;s from, which device (with a link), what&apos;s wrong, and a link to the
            Airtable record, which is where their shipping address is.
          </DocP>
          <DocP>
            The student is matched by the <strong>Student Email</strong> on the form, and the device by the equipment they
            chose (Laptop or Laptop Charger → their laptop; Wifi Unit → their hotspot or booster). If either can&apos;t be
            matched, the ticket says so and you can match it by hand on the ticket page.
          </DocP>
          <DocP>
            Open tickets are listed under <strong>Support tickets</strong> on Needs attention and on the student&apos;s
            hardware page. On a ticket, move the status from <strong>Open</strong> → <strong>In progress</strong> →{' '}
            <strong>Replacement sent</strong> → <strong>Resolved</strong>, with a note that goes into the history. A ticket
            nobody updates for <strong>2 days</strong> is posted again in #student-hardware.
          </DocP>
          <DocTip>
            Sending a replacement? Record it with <strong>Replace laptop</strong> / <strong>Replace charger</strong> on the
            student&apos;s hardware page so it counts toward their one each.
          </DocTip>
        </>
      ),
    },
    {
      id: 'reminders',
      title: 'Reminders and Slack',
      content: (
        <>
          <DocP>
            A daily job runs at <strong>8:30am Pacific</strong>. Each message goes out once; on days with nothing new,
            nothing is posted.
          </DocP>
          <DocH3>In #student-hardware (staff)</DocH3>
          <DocList>
            <li>📶 <strong>Hotspot plans up for renewal</strong> — 45 days before each plan ends.</li>
            <li>📬 <strong>Return reminders sent today</strong> — who was reminded, for what, and which reminder it was.</li>
            <li>🕵️ <strong>Not returned after 60 days</strong> — to confirm lost.</li>
            <li>🛠️ <strong>New support tickets</strong> (right away), and ⏳ tickets with no update for 2 days.</li>
            <li>🎓 <strong>Graduate/drop review</strong> — on the first day of each break.</li>
          </DocList>
          <DocH3>To students</DocH3>
          <DocP>
            When something is awaiting return, the student gets a reminder <strong>48 hours</strong> later, again{' '}
            <strong>5 days</strong> after that, then <strong>every week</strong> until it&apos;s received or marked lost.
            Each reminder is a Slack DM, an email and a bell notification, with how to send it back.
          </DocP>
          <DocNote>
            Slack messages find people by their LMS email. If a student&apos;s LMS email doesn&apos;t match their Slack
            account, they still get the email and bell notification.
          </DocNote>
        </>
      ),
    },
    {
      id: 'students-see',
      title: 'What Students See',
      content: (
        <>
          <DocList>
            <li><strong>My Equipment</strong> in their course sidebar (also on their Profile page): each item as on loan, yours to keep, or <strong>please send this back</strong>; whether their one laptop and one charger replacement are still available; and <strong>Report a problem with my equipment</strong>, which opens the Equipment Support Form.</li>
            <li>An orange <strong>Send back</strong> badge on My Equipment and a banner on My Courses while something is awaiting return, with how to send it back: use the box it came in (or contact Catie), pack it carefully, and shipping is covered by a prepaid label or a reimbursed receipt.</li>
            <li>The <strong>equipment check-in</strong> when you send one.</li>
          </DocList>
          <DocNote>Students never see the waitlist, tickets, other students&apos; equipment, or anything on the staff pages.</DocNote>
        </>
      ),
    },
  ]

  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Hardware</h1>
      <p className="text-sm text-muted-text mb-8">Track the laptops, hotspots and wifi boosters loaned to students, from purchase to return.</p>

      <DocAccordion items={items} />
    </>
  )
}
