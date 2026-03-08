import { DocH2, DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'

export default function CareerDev() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Career Development</h1>
      <p className="text-sm text-muted-text mb-8">Manage career dev content separately and optionally surface it on coding day cards.</p>

      <DocH2>What Is the Career Dev Section?</DocH2>
      <DocP>
        Career Development is a separate module category for content that lives outside the weekly coding curriculum —
        things like resume workshops, portfolio days, or job-search resources. Career Dev modules, days, assignments,
        resources, and quizzes are managed the same way as coding content but are kept in their own section.
      </DocP>
      <DocNote>
        The Career Dev section only appears when at least one module with the <strong>career</strong> category exists in
        the course.
      </DocNote>

      <DocH2>Creating Career Dev Content</DocH2>
      <DocP>
        Use the <strong>+ Create</strong> button in the course sidebar to create assignments, resources, or quizzes.
        When your course has coding modules, a <strong>Section</strong> dropdown appears — choose
        <strong> Career Development</strong> to place the item in a career dev module.
      </DocP>
      <DocStep number={1}>Click <strong>+ Create</strong> in the sidebar.</DocStep>
      <DocStep number={2}>Select the content type (Assignment, Resource, or Quiz).</DocStep>
      <DocStep number={3}>Set <strong>Section</strong> to <strong>Career Development</strong>.</DocStep>
      <DocStep number={4}>Pick a <strong>Module</strong> from the dropdown, or click <strong>+ New module</strong> to create one on the spot.</DocStep>
      <DocStep number={5}>Optionally choose a <strong>Day</strong> within that module.</DocStep>
      <DocStep number={6}>Click <strong>Create & Edit</strong> (assignments) or <strong>Create →</strong> (resources/quizzes).</DocStep>

      <DocTip>
        If no career dev modules exist yet, switching to the Career Development section automatically opens the new
        module form — type a name and hit Create, then continue.
      </DocTip>

      <DocH2>Cross-Posting to the Course Outline</DocH2>
      <DocP>
        Career Dev content normally lives only in the Career Dev section. But you can also <strong>cross-post</strong> any
        item so it appears on a specific coding day card in the Course Outline, with a purple
        &ldquo;Career Dev&rdquo; badge. The item is not duplicated — it lives in Career Dev and is simply surfaced in the
        coding outline.
      </DocP>

      <DocH3>How to cross-post at creation time</DocH3>
      <DocStep number={1}>Open <strong>+ Create</strong> and choose Career Development as the section.</DocStep>
      <DocStep number={2}>Check <strong>Also show in Course Outline?</strong></DocStep>
      <DocStep number={3}>Choose a <strong>Coding Module</strong> and (optionally) a <strong>Day</strong>.</DocStep>
      <DocStep number={4}>Create the item — it will appear in both the Career Dev section and the selected coding day.</DocStep>

      <DocH3>How cross-posted items appear</DocH3>
      <DocList>
        <li>In the <strong>instructor Course Editor</strong> — cross-posted items appear on the target day with a purple &ldquo;Career Dev&rdquo; badge. They are read-only on the coding day; edit them from the Career Dev section.</li>
        <li>In the <strong>student Course Outline</strong> — cross-posted items appear inline on the day card with the same badge.</li>
        <li>In the <strong>student day detail page</strong> — cross-posted assignments, resources, and quizzes show up alongside that day&apos;s native content, each labeled &ldquo;Career Dev&rdquo;.</li>
      </DocList>

      <DocNote>
        If the coding day a cross-post targets is deleted, the item stays in Career Dev — it simply stops appearing on
        the coding outline.
      </DocNote>

      <DocH2>Adding a New Module on the Fly</DocH2>
      <DocP>
        When creating content, click <strong>+ New module</strong> below the Module dropdown to create a module without
        leaving the Create modal. Type the module title, press Enter or click <strong>Create</strong>, and the new module
        is immediately selected. This works for both coding and career dev sections.
      </DocP>
    </>
  )
}
