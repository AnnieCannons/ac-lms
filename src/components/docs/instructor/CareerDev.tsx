import { DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'
import { DocAccordion, type DocAccordionItem } from '@/components/docs/DocAccordion'

export default function CareerDev() {
  const items: DocAccordionItem[] = [
    {
      id: 'overview',
      title: 'What Is Career Development?',
      content: (
        <>
          <DocP>
            Career Development is a separate module category for content that lives outside the weekly coding
            curriculum — things like resume workshops, portfolio days, or job-search resources. Career Dev modules,
            days, assignments, resources, quizzes, and wikis are managed the same way as coding content, but are
            filed under their own <strong>category</strong> and kept in their own section.
          </DocP>
          <DocP>
            <strong>Career Development</strong> is always listed in the course sidebar, alongside Course Outline,
            Assignments, Quizzes, Class Resources, Instructor Resources, and Level Up Your Skills. Opening it takes
            you to a Course Editor view that&apos;s filtered to modules with the career category — it&apos;s empty
            until you add or tag a module as Career Development.
          </DocP>
          <DocNote>
            TAs can open Career Development like any other section, but — as everywhere else in the Course Editor —
            their view is read-only.
          </DocNote>
        </>
      ),
    },
    {
      id: 'creating',
      title: 'Creating Career Dev Content',
      content: (
        <>
          <DocP>
            Use the <strong>+ Create</strong> button in the course sidebar to add an assignment, resource, quiz, or
            wiki anywhere in the course, career dev included. The <strong>Section</strong> dropdown in that modal
            always offers all three choices — <strong>Course Outline</strong>, <strong>Career Development</strong>,
            and <strong>Level Up Your Skills</strong> — regardless of what the course already contains.
          </DocP>
          <DocStep number={1}>Click <strong>+ Create</strong> in the sidebar.</DocStep>
          <DocStep number={2}>Under &ldquo;What would you like to create?&rdquo; pick <strong>Assignment</strong>, <strong>Resource</strong>, <strong>Quiz</strong>, or <strong>Wiki</strong>.</DocStep>
          <DocStep number={3}>Set <strong>Section</strong> to <strong>Career Development</strong>.</DocStep>
          <DocStep number={4}>Pick a <strong>Module</strong> from the dropdown, or click <strong>+ New module</strong> to reveal an inline title field and click <strong>Save</strong> to create one on the spot.</DocStep>
          <DocStep number={5}>Optionally choose a <strong>Day</strong> within that module (required for assignments, optional for everything else).</DocStep>
          <DocStep number={6}>Fill in the type-specific fields, then click <strong>Create &amp; Edit →</strong> (assignments), <strong>Create Wiki →</strong> (wikis), or <strong>Create →</strong> (resources and quizzes).</DocStep>

          <DocTip>
            If no career dev modules exist yet, the Module dropdown will have nothing to select — it only lists
            modules that already belong to the chosen section. Click <strong>+ New module</strong> to reveal the
            inline title field and name the first one before you can finish creating the item.
          </DocTip>

          <DocP>
            You can also add a career dev module directly from the Career Development page itself: use the{' '}
            <strong>Add Module</strong> card at the bottom of the module list. A module created there is
            automatically tagged with the Career Development category — no Section dropdown needed. See the{' '}
            <strong>Course Editor</strong> doc for the full mechanics of adding modules and days.
          </DocP>

          <DocH3>Recategorizing an Existing Module</DocH3>
          <DocP>
            A module doesn&apos;t have to be created as Career Development to end up there — every module row in the
            Course Editor has a <strong>category</strong> dropdown next to its <strong>Published</strong>/
            <strong>Draft</strong> toggle, with the choices <strong>Unassigned</strong>, <strong>Course
            Outline</strong>, <strong>Level Up Your Skills</strong>, <strong>Class Resources</strong>, and{' '}
            <strong>Career Development</strong>. Switching it to <strong>Career Development</strong> moves the
            module — and everything inside it — into this section right away.
          </DocP>
          <DocNote>
            That category dropdown is desktop-only; it&apos;s hidden on narrow screens, so recategorize modules from
            a wider viewport.
          </DocNote>
        </>
      ),
    },
    {
      id: 'cross-posting',
      title: 'Cross-Posting to the Course Outline',
      content: (
        <>
          <DocP>
            Career Dev content normally lives only in the Career Development section. But you can also{' '}
            <strong>cross-post</strong> any item so it also appears on a specific coding day card in the Course
            Outline, with a purple &ldquo;Career Dev&rdquo; badge. The item isn&apos;t duplicated — it still lives in
            Career Development and is simply surfaced on the coding day too.
          </DocP>

          <DocH3>How to Cross-Post</DocH3>
          <DocP>
            The cross-post option only appears while you&apos;re creating a Career Development item, and only if the
            course already has at least one non-career, non-Level-Up module to cross-post into.
          </DocP>
          <DocStep number={1}>Open <strong>+ Create</strong> and set <strong>Section</strong> to <strong>Career Development</strong>.</DocStep>
          <DocStep number={2}>Check <strong>Also show in Course Outline?</strong></DocStep>
          <DocStep number={3}>Choose a <strong>Coding Module</strong> and, optionally, a <strong>Day</strong>.</DocStep>
          <DocStep number={4}>Finish creating the item — it now appears in both the Career Development section and the selected coding day.</DocStep>

          <DocNote>
            The <strong>Also show in Course Outline?</strong> checkbox appears no matter which content type you have
            selected — but cross-posting only actually works for assignments, resources, and quizzes. If you check
            it while creating a <strong>Wiki</strong>, the choice is silently ignored; wikis have no cross-post field
            to save it to.
          </DocNote>

          <DocNote>
            The cross-post target is set once, at creation. There&apos;s no field on the assignment, resource, or
            quiz editor to view or change it afterward — to move the cross-post, delete the item and recreate it.
          </DocNote>

          <DocH3>How Cross-Posted Items Appear</DocH3>
          <DocList>
            <li>
              In the <strong>instructor Course Editor</strong> — cross-posted items appear on the target day with a
              purple &ldquo;Career Dev&rdquo; badge and never get a drag handle there, so they can&apos;t be
              reordered from the coding side. Assignments and resources show as a static preview with no publish
              toggle or delete control: an assignment&apos;s title still links through to its full editor, but a
              resource&apos;s title doesn&apos;t link anywhere — edit it from Career Development instead. Quizzes are
              the exception: a cross-posted quiz keeps its normal title link and Published/Draft toggle, so you can
              open or publish it right from the coding day.
            </li>
            <li>In the <strong>student Course Outline</strong> — cross-posted items appear inline on the day card with the same badge.</li>
            <li>In the <strong>student day detail page</strong> — cross-posted assignments, resources, and quizzes show up alongside that day&apos;s native content, each labeled &ldquo;Career Dev&rdquo;.</li>
          </DocList>

          <DocNote>
            If the coding day a cross-post targets is deleted, the item stays in Career Development — it simply stops
            appearing on the coding outline.
          </DocNote>
        </>
      ),
    },
  ]

  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Career Development</h1>
      <p className="text-sm text-muted-text mb-8">Manage career dev content separately and optionally surface it on coding day cards.</p>

      <DocAccordion items={items} />
    </>
  )
}
