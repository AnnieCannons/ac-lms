import { DocH2, DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'

export default function Partnerships() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Partnerships</h1>
      <p className="text-sm text-muted-text mb-8">Track and manage external organizations — funders, employers, mentors, and other partners.</p>

      <DocNote>
        The Partnerships dashboard is only visible to <strong>Staff</strong> and <strong>Admins</strong>. Instructors
        with the Instructor role cannot access this section.
      </DocNote>

      <DocH2>Opening the Partnerships Dashboard</DocH2>
      <DocP>
        Click the <strong>Partnerships</strong> card on the main instructor dashboard, or navigate directly to
        <strong> /instructor/partnerships</strong>. The page lists all partner organizations with their status,
        type tags, and primary contact at a glance.
      </DocP>

      <DocH2>Adding a Partner</DocH2>
      <DocStep number={1}>Click <strong>+ Add Partner</strong> at the top of the Partnerships page.</DocStep>
      <DocStep number={2}>Fill in the partner&apos;s details (see fields below).</DocStep>
      <DocStep number={3}>Click <strong>Save</strong> to create the record.</DocStep>

      <DocH2>Partner Fields</DocH2>
      <DocList>
        <li><strong>Name</strong> — the organization&apos;s name (required)</li>
        <li><strong>Status</strong> — current relationship stage: Prospect, Active, In Onboarding, or Inactive</li>
        <li><strong>Partner Types</strong> — one or more categories that describe the relationship (see below)</li>
        <li><strong>City / State</strong> — location, shown on the list view</li>
        <li><strong>Website</strong> — the organization&apos;s URL</li>
        <li><strong>Notes</strong> — free-text internal notes visible only to staff and admins</li>
        <li><strong>Tags</strong> — custom labels for filtering and searching; type a tag and press Enter to add it</li>
        <li><strong>Internal Owner</strong> — the staff or admin member responsible for this relationship</li>
      </DocList>

      <DocH3>Partner Types</DocH3>
      <DocList>
        <li><strong>Service Provider</strong> — vendors or organizations providing services to the program</li>
        <li><strong>Corporate</strong> — employer partners or companies that hire or sponsor learners</li>
        <li><strong>Funder</strong> — grantmakers, foundations, or other funding sources</li>
        <li><strong>Advisory</strong> — individuals or organizations in an advisory capacity</li>
        <li><strong>Mentorship</strong> — mentors or mentorship organizations connected to students</li>
        <li><strong>Media</strong> — press, media, or communications partners</li>
      </DocList>
      <DocTip>
        A partner can have multiple types — for example, a company might be both Corporate and Mentorship if they
        hire learners and also provide mentors.
      </DocTip>

      <DocH2>Contacts</DocH2>
      <DocP>
        Each partner record can have one or more contacts. Add contacts in the <strong>Contacts</strong> section of
        the partner form:
      </DocP>
      <DocList>
        <li><strong>Name</strong> — the contact&apos;s full name (required for the contact to be saved)</li>
        <li><strong>Title</strong> — their job title or role at the organization</li>
        <li><strong>Email</strong> — primary contact email</li>
        <li><strong>Phone</strong> — phone number</li>
        <li><strong>Notes</strong> — anything useful to remember about this specific person</li>
        <li><strong>Primary contact</strong> — check this box to mark one contact as the main point of contact; their name appears on the partner list view</li>
      </DocList>
      <DocStep number={1}>Click <strong>+ Add contact</strong> to add a second (or third) contact.</DocStep>
      <DocStep number={2}>Check <strong>Primary contact</strong> on the person who should be the main point of contact.</DocStep>
      <DocTip>
        You can add contacts later — create the partner record first, then edit it to add contacts once you have
        the information.
      </DocTip>

      <DocH2>Editing a Partner</DocH2>
      <DocP>
        Click any partner card on the list to open their detail page. All fields are editable — make your changes
        and click <strong>Save</strong>.
      </DocP>

      <DocH2>Partner Status</DocH2>
      <DocList>
        <li><strong>Prospect</strong> — an organization you&apos;re interested in but haven&apos;t formalized a relationship with yet</li>
        <li><strong>In Onboarding</strong> — actively setting up the partnership</li>
        <li><strong>Active</strong> — a live, ongoing relationship</li>
        <li><strong>Inactive</strong> — a former partner or a paused relationship; keeps the record for history</li>
      </DocList>
      <DocNote>
        Status is just a label — it doesn&apos;t affect access or permissions anywhere in the system.
      </DocNote>
    </>
  )
}
