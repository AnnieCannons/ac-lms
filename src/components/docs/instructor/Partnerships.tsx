import Link from 'next/link'
import { DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'
import { DocAccordion } from '@/components/docs/DocAccordion'

export default function Partnerships() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Partnerships</h1>
      <p className="text-sm text-muted-text mb-8">Track and manage external organizations — funders, employers, mentors, and other partners.</p>

      <DocNote>
        The Partnerships dashboard is only visible to <strong>Staff</strong> and <strong>Admins</strong>. Instructors
        with the Instructor role cannot access this section.
      </DocNote>

      <DocAccordion
        items={[
          {
            id: 'dashboard',
            title: 'Opening Partnerships & Getting Around',
            content: (
              <>
                <DocStep number={1}>
                  Click the <strong>Partnerships</strong> card on the main instructor dashboard, or navigate directly
                  to <strong>/instructor/partnerships</strong>.
                </DocStep>
                <DocP>
                  The Partners dashboard opens with a row of <strong>Departments</strong> cards — Student Success,
                  Career Development, ResourceFull, Funding Partners, and Admissions — each showing how many partners
                  are enrolled. Click a card to jump to that department&apos;s filtered partner list. Below that, an{' '}
                  <strong>All Partners</strong> list shows every organization regardless of department.
                </DocP>
                <DocNote>
                  A red badge next to the partner count (e.g. &ldquo;3 need follow-up&rdquo;) flags partners with no
                  logged interaction in the last 30 days.
                </DocNote>
                <DocP>
                  A persistent sidebar (collapsible, drag to resize) gives quick links to <strong>Dashboard</strong>,
                  each department, <strong>Student Referrals</strong>, <strong>Email Lists</strong>, and{' '}
                  <strong>Add Partner</strong> — available from anywhere in the Partnerships section.
                </DocP>
                <DocTip>
                  From the All Partners list you can also jump to <strong>Map View →</strong> or{' '}
                  <strong>Student Referrals →</strong> using the links above the list.
                </DocTip>
              </>
            ),
          },
          {
            id: 'adding',
            title: 'Adding a Partner',
            content: (
              <>
                <DocStep number={1}>
                  Click <strong>+ Add Partner</strong> (dashboard header, sidebar, or a department&apos;s partner
                  list) or <strong>Add Partner</strong> in the sidebar.
                </DocStep>
                <DocStep number={2}>
                  Under <strong>Organization</strong>, enter the <strong>Name</strong> (required). Typing three or
                  more characters checks for similar existing partners and lists any matches so you can avoid
                  creating a duplicate.
                </DocStep>
                <DocStep number={3}>
                  Check <strong>Nationwide (operates across the US)</strong> if the org isn&apos;t tied to a single
                  location, or leave it unchecked and enter one or more <strong>City</strong> / <strong>State</strong>{' '}
                  pairs. Click <strong>+ Add location</strong> for organizations with more than one office.
                </DocStep>
                <DocStep number={4}>Enter the organization&apos;s <strong>Website</strong> (optional).</DocStep>
                <DocStep number={5}>
                  Under <strong>Departments</strong>, select every team that will work with this partner. This
                  controls which department tabs the partner record gets once it&apos;s created.
                </DocStep>
                <DocStep number={6}>
                  Under <strong>Partner Type(s)</strong>, select one or more categories that describe the
                  relationship (see below).
                </DocStep>
                <DocStep number={7}>
                  Under <strong>Services Provided</strong>, select the categories of support this org offers. If you
                  select <strong>Other</strong>, a text field appears to describe it.
                </DocStep>
                <DocStep number={8}>
                  Under <strong>Contacts</strong>, enter at least a <strong>Name</strong> for each person (required
                  for the contact to be saved); add <strong>Title</strong>, <strong>Email</strong>,{' '}
                  <strong>Phone</strong>, <strong>LinkedIn URL</strong>, <strong>Website</strong>, and{' '}
                  <strong>Notes</strong> as you have them. Click <strong>+ Add contact</strong> for additional
                  contacts, and mark one contact <strong>Primary</strong>.
                </DocStep>
                <DocStep number={9}>
                  Under <strong>Relationship</strong>, set the <strong>Internal Owner</strong> (defaults to you),{' '}
                  <strong>How We Met</strong>, <strong>Referred By</strong>, and <strong>Last Interaction Date</strong>{' '}
                  if known.
                </DocStep>
                <DocStep number={10}>
                  Add any <strong>Notes</strong> and <strong>Tags</strong> (type a tag and press Enter, or click{' '}
                  <strong>Add</strong>).
                </DocStep>
                <DocStep number={11}>Click <strong>Create Partner</strong>.</DocStep>
                <DocTip>
                  Selecting the <strong>Admissions Referral</strong> partner type automatically enrolls the partner in
                  the Admissions department too, even if you didn&apos;t check it under Departments.
                </DocTip>
              </>
            ),
          },
          {
            id: 'types-depts',
            title: 'Partner Types, Departments & Status',
            content: (
              <>
                <DocH3>Partner Types</DocH3>
                <DocList>
                  <li><strong>Service Provider</strong> — vendors or organizations providing services to the program</li>
                  <li><strong>Corporate</strong> — employer partners or companies that hire or sponsor learners</li>
                  <li><strong>Funder</strong> — grantmakers, foundations, or other funding sources</li>
                  <li><strong>Advisory</strong> — individuals or organizations in an advisory capacity</li>
                  <li><strong>Mentorship</strong> — mentors or mentorship organizations connected to students</li>
                  <li><strong>Apprenticeship</strong> — organizations offering apprenticeship placements</li>
                  <li><strong>Media</strong> — press, media, or communications partners</li>
                  <li><strong>Admissions Referral</strong> — organizations that refer prospective students to the program</li>
                </DocList>
                <DocTip>
                  A partner can have multiple types — for example, a company might be both Corporate and Mentorship if
                  they hire learners and also provide mentors.
                </DocTip>

                <DocH3>Departments</DocH3>
                <DocP>A partner can be enrolled in any combination of five departments:</DocP>
                <DocList>
                  <li><strong>Student Success</strong> — track student referrals and connected support orgs</li>
                  <li><strong>Career Development</strong> — mentorship, apprenticeships, and guest speakers</li>
                  <li><strong>ResourceFull</strong> — service provider outreach and onboarding pipeline</li>
                  <li><strong>Funding Partners</strong> — funders, grant history, and follow-up tracking</li>
                  <li><strong>Admissions</strong> — referral partners and student intake coordination</li>
                </DocList>

                <DocH3>Department Status</DocH3>
                <DocP>
                  Three departments track a status (&ldquo;stage&rdquo;) pipeline that&apos;s specific to that
                  department&apos;s workflow — it&apos;s set per department, not once for the whole partner, since the
                  same organization can be at a different stage with each team:
                </DocP>
                <DocList>
                  <li><strong>Career Development</strong> — Prospect → In Conversation → Active Mentorship / Active Apprenticeship → Alumni / Inactive</li>
                  <li><strong>ResourceFull</strong> — Identified for outreach → Invited to join / Invited to rejoin → Coordinating/In Conversation → Meeting Scheduled → Sign up in progress → Onboarded / Seeking contact</li>
                  <li><strong>Funding Partners</strong> — Prospect → In Conversation → Committed → Received / Lapsed</li>
                </DocList>
                <DocP>
                  Student Success and Admissions don&apos;t track a stage — their department panel shows &ldquo;No
                  stages tracked&rdquo; instead, and tracks student referral counts in its place.
                </DocP>
              </>
            ),
          },
          {
            id: 'detail-page',
            title: 'The Partner Detail Page',
            content: (
              <>
                <DocStep number={1}>Click any partner card on a list to open its detail page.</DocStep>
                <DocP>
                  The page header shows the partner&apos;s name, website, and location, with an <strong>Edit</strong>{' '}
                  link. Below it, a <strong>Contacts</strong> card on the left lists every contact with an{' '}
                  <strong>Add Contact</strong> button; the tab bar on the right has an <strong>Overview</strong> tab
                  plus one tab per department the partner is enrolled in, and a <strong>+ Dept</strong> button to
                  enroll it in another.
                </DocP>

                <DocH3>Overview Tab</DocH3>
                <DocP>
                  Shows a card per enrolled department with its current stage and most recent logged contact, a{' '}
                  <strong>Ratings</strong> summary if any service categories have been rated, and a combined{' '}
                  <strong>Activity History</strong> across every department. Click a department card to jump straight
                  to that department&apos;s tab.
                </DocP>

                <DocH3>A Department Tab</DocH3>
                <DocList>
                  <li>
                    <strong>Update Status</strong> — click to open a dropdown of that department&apos;s stages (see
                    the Types, Departments & Status section) and pick a new one.
                  </li>
                  <li>
                    <strong>Log Interaction</strong> — opens a form to record a contact person, an interaction type
                    (Email, Phone Call, Video Call, In-Person Meeting, or Other), a note, and a date. Check{' '}
                    <strong>Also update status</strong> to change the stage in the same step, or{' '}
                    <strong>Send me a Slack follow-up reminder</strong> to get pinged after a set amount of time.
                  </li>
                  <li><strong>Owner</strong> — a dropdown to reassign the internal owner for this department.</li>
                  <li>
                    <strong>Needs Outreach</strong> (Funding Partners only) — Yes / No / Waiting / Discuss.
                  </li>
                  <li>
                    <strong>Do not email</strong> — a checkbox scoped to this department only; the same partner can be
                    do-not-email for one team and still contactable by another.
                  </li>
                  <li>
                    <strong>Remove from [Department]</strong> — unenrolls the partner from this department only
                    (doesn&apos;t delete the partner).
                  </li>
                </DocList>
                <DocP>
                  Below those controls, <strong>Activity History</strong> lists every logged interaction and status
                  change for that department, newest first.
                </DocP>
                <DocNote>
                  The <strong>Admissions</strong> tab additionally shows a <strong>Student Referrals</strong> section
                  for students referred to AnnieCannons by this partner (inbound). The{' '}
                  <strong>Student Success</strong> tab shows the reverse — students AnnieCannons referred out to this
                  partner (outbound). Both have a small form to log a new referral by student name and date.
                </DocNote>

                <DocH3>Managing Contacts</DocH3>
                <DocP>
                  Click <strong>Add Contact</strong> (or the pencil icon on an existing contact to edit it) to open
                  the contact form: Name (required), Title, Email, Phone, LinkedIn URL, Website URL, and Notes. If
                  the partner spans more than one department, choose which departments the contact is{' '}
                  <strong>Visible in</strong> — leave all unchecked to share the contact across every department — and
                  which departments they&apos;re the <strong>Primary contact</strong> for.
                </DocP>
                <DocP>
                  Use the archive icon to archive a contact who&apos;s no longer active without losing their history;
                  archived contacts can be unarchived or, once archived, permanently deleted.
                </DocP>

                <DocH3>Editing a Partner</DocH3>
                <DocStep number={1}>
                  Click the <strong>Edit</strong> link (pencil icon) next to the partner&apos;s name in the header —
                  this opens the Organization/Departments/Partner Type(s)/Services Provided fields directly for
                  editing.
                </DocStep>
                <DocStep number={2}>
                  Make your changes and click <strong>Save Changes</strong>, or <strong>Cancel</strong> to discard
                  them. Either one takes you to a read-only summary of those fields, which has its own{' '}
                  <strong>Edit</strong> link if you need to go back into the form.
                </DocStep>
                <DocStep number={3}>
                  Click <strong>← Back</strong> at the top to return to the Overview / department tabs.
                </DocStep>
                <DocNote>
                  Contacts and the internal owner are managed from the Contacts card and each department tab, not from
                  this edit form.
                </DocNote>

                <DocH3>Deleting a Partner</DocH3>
                <DocStep number={1}>From the Edit view, click <strong>Delete partner</strong>.</DocStep>
                <DocStep number={2}>Confirm by clicking <strong>Yes, delete</strong> in the dialog.</DocStep>
                <DocNote>
                  Deleting a partner permanently removes it along with all related contacts, interactions, and
                  history. This cannot be undone.
                </DocNote>
              </>
            ),
          },
          {
            id: 'map-emaillists',
            title: 'Map View & Email Lists',
            content: (
              <>
                <DocH3>Map View</DocH3>
                <DocStep number={1}>
                  Click <strong>Map View →</strong> from the Partners dashboard or any department&apos;s partner
                  list.
                </DocStep>
                <DocP>
                  Use the department pills at the top to switch which department&apos;s partners are plotted. Each
                  state is shaded by how many matching partners are based there — hover a state to see its name and
                  partner count, and click it to filter the partner list beside the map to that state (click another
                  state to add it, or click a selected state again to remove it). Click any partner card in that list
                  to open its detail page.
                </DocP>

                <DocH3>Email Lists</DocH3>
                <DocStep number={1}>Click <strong>Email Lists</strong> in the sidebar.</DocStep>
                <DocStep number={2}>Click <strong>+ New Email List</strong>.</DocStep>
                <DocStep number={3}>Filter partners and review the resulting contact list.</DocStep>
                <DocStep number={4}>Copy the list or save it to keep a record of the outreach.</DocStep>
                <DocP>
                  The Email Lists page keeps a history of every list you&apos;ve built, with its department and
                  contact count, so you can track what&apos;s already gone out.
                </DocP>
              </>
            ),
          },
          {
            id: 'referrals-ratings',
            title: 'Referrals & Ratings',
            content: (
              <DocP>
                You can log student referrals to partner organizations, send rating invites, and track feedback from
                the department tabs on a partner record described above, or from the global{' '}
                <strong>Student Referrals</strong> page (sidebar link, or <strong>Rating submissions →</strong> from
                there for every rating submitted). See the{' '}
                <Link href="/docs/instructor/referrals" className="text-teal-primary underline">
                  Referrals &amp; Ratings
                </Link>{' '}
                guide for the full workflow, including how to update the Slack notification recipient.
              </DocP>
            ),
          },
        ]}
      />
    </>
  )
}
