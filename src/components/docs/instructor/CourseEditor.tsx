import { DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'
import { DocAccordion, type DocAccordionItem } from '@/components/docs/DocAccordion'

export default function CourseEditor() {
  const items: DocAccordionItem[] = [
    {
      id: 'structure',
      title: 'Modules, Days, and How Content Is Organized',
      content: (
        <>
          <DocP>
            Your course is organized into <strong>modules</strong> (usually one per week) containing{' '}
            <strong>days</strong>. Days aren&apos;t locked to Monday–Thursday — a module can have any days you add,
            in any order, with any name. Each day can hold assignments, resources, quizzes, and wikis.
          </DocP>
          <DocList>
            <li>Click a module&apos;s header to expand or collapse it. Every module starts collapsed when you first open the Course Editor.</li>
            <li>Each day&apos;s header shows a count in parentheses — the total number of assignments, resources, quizzes, and wikis inside it.</li>
            <li>Double-click a day&apos;s name to rename it inline.</li>
            <li>Click the pencil icon next to a module&apos;s title to rename it.</li>
            <li>Use the <strong>Section</strong> dropdown on a module&apos;s header (desktop only) to file it under <strong>Unassigned</strong>, <strong>Course Outline</strong>, <strong>Level Up Your Skills</strong>, <strong>Class Resources</strong>, or <strong>Career Development</strong> — this controls which sidebar category the module shows up under.</li>
          </DocList>
          <DocTip>
            Use the <strong>Expand all</strong> / <strong>Collapse all</strong> links pinned above the module list to
            open or fold every module at once instead of clicking through them one at a time.
          </DocTip>
          <DocP>
            A search bar above the module list (&ldquo;Search assignments and resources…&rdquo;) finds matches across
            the entire course as you type. Click a result to jump straight to it instead of scrolling through every
            module.
          </DocP>
        </>
      ),
    },
    {
      id: 'adding-content',
      title: 'Adding Content',
      content: (
        <>
          <DocP>There are two ways to add an assignment, resource, quiz, or wiki: from the sidebar, or directly on a day.</DocP>

          <DocH3>From the Sidebar</DocH3>
          <DocStep number={1}>Click <strong>+ Create</strong> in the course sidebar.</DocStep>
          <DocStep number={2}>Under &ldquo;What would you like to create?&rdquo; pick <strong>Assignment</strong>, <strong>Resource</strong>, <strong>Quiz</strong>, or <strong>Wiki</strong>.</DocStep>
          <DocStep number={3}>Choose a <strong>Section</strong> — <strong>Course Outline</strong>, <strong>Career Development</strong>, or <strong>Level Up Your Skills</strong> — then a <strong>Module</strong> (or click <strong>+ New module</strong> to create one on the spot), and a <strong>Day</strong>. Day is required for assignments and optional for everything else.</DocStep>
          <DocStep number={4}>Fill in the type-specific fields, then click <strong>Create &amp; Edit →</strong> (assignments), <strong>Create Wiki →</strong> (wikis), or <strong>Create →</strong> (resources and quizzes).</DocStep>
          <DocP>
            See the <strong>Assignments &amp; Grading</strong>, <strong>Managing Resources</strong>, and{' '}
            <strong>Quizzes</strong> docs for what happens after you land in each editor.
          </DocP>

          <DocH3>Directly on a Day</DocH3>
          <DocP>
            Every day&apos;s header has a compact <strong>+ Add ▾</strong> menu with the same four options, but it
            skips the module/day picker since you&apos;re already on the right day. What it opens depends on the type:
          </DocP>
          <DocList>
            <li><strong>Assignment</strong> — opens a full &ldquo;New Assignment&rdquo; page with Instructions, How to turn this in, a due date, and a checklist editor.</li>
            <li><strong>Resource</strong> — opens a small inline form right in the day panel: a type dropdown, title, and URL/content field, with its own <strong>Add</strong> button.</li>
            <li><strong>Quiz</strong> — opens the same <strong>Create</strong> modal as the sidebar button, pre-filled to this module and day.</li>
            <li><strong>Wiki</strong> — creates a new wiki titled &ldquo;New Wiki&rdquo; immediately, with no modal, ready to edit in place.</li>
          </DocList>
          <DocP>
            A module&apos;s header also has a compact <strong>+</strong> button that opens the sidebar <strong>Create</strong> modal pre-filled to that module.
          </DocP>

          <DocH3>Adding a Day or Module</DocH3>
          <DocStep number={1}>Inside an expanded module, type a name into the <strong>Add a day (e.g. Monday)</strong> field.</DocStep>
          <DocStep number={2}>Press Enter or click <strong>Add</strong>.</DocStep>
          <DocP>To add a whole new module, use the <strong>Add Module</strong> card at the bottom of the Course Editor:</DocP>
          <DocStep number={1}>Enter a module title (e.g. &ldquo;Week 1: Intro&rdquo;) and, optionally, a week number.</DocStep>
          <DocStep number={2}>Click <strong>Add</strong>.</DocStep>
        </>
      ),
    },
    {
      id: 'wikis',
      title: 'Wikis',
      content: (
        <>
          <DocP>
            A wiki is a freeform rich-text block you can attach to an entire module or to a single day — useful for
            FAQs, setup notes, or anything that doesn&apos;t fit the assignment/resource structure.
          </DocP>
          <DocList>
            <li>Create a module-level wiki with <strong>+ Create → Wiki</strong> and no day selected, or a day-level wiki with that day&apos;s <strong>+ Add ▾ → Wiki</strong>.</li>
            <li>Click the title or content to edit. Changes autosave about a second after you stop typing — a status label shows <strong>Saving…</strong>, <strong>Saved ✓</strong>, or <strong>Save failed</strong>.</li>
            <li>A manual <strong>Save</strong> link appears next to the title whenever the wiki is idle, if you want to force a save immediately.</li>
            <li>Toggle <strong>Published</strong> / <strong>Draft</strong> to control student visibility, same as other content types.</li>
            <li>Click the chevron to collapse a wiki once you&apos;re done editing it.</li>
          </DocList>
          <DocNote>
            Deleting a wiki is immediate and permanent — after the confirmation prompt, it is <strong>not</strong>{' '}
            sent to Trash like modules, days, assignments, and resources are. There is no way to recover a deleted wiki.
          </DocNote>
        </>
      ),
    },
    {
      id: 'reordering',
      title: 'Reordering, Moving, and Copying',
      content: (
        <>
          <DocP>Grab the grip handle (⠿) on the left of any item to drag it:</DocP>
          <DocList>
            <li><strong>Modules</strong> — reorders which week comes first.</li>
            <li><strong>Days</strong> — reorders days within their module.</li>
            <li><strong>Assignments</strong> — drag within a day to reorder, or drop it on a different day (or on an assignment that lives in a different day) to move it there.</li>
            <li><strong>Resources</strong> — same as assignments: reorder within a day, or drag across days to move.</li>
            <li><strong>Quizzes</strong> — drag a quiz card to a different day to move it. Unlike assignments and resources, quizzes can&apos;t be reordered within the same day by dragging — only moved between days. Quizzes cross-posted from Career Development can&apos;t be dragged at all.</li>
          </DocList>
          <DocTip>
            The item highlights when it&apos;s over a valid drop target.
          </DocTip>

          <DocH3>Moving Without Drag-and-Drop</DocH3>
          <DocP>
            Assignment and resource cards have a small <strong>⇄</strong> button for moving them to a distant week
            without dragging across a long list:
          </DocP>
          <DocStep number={1}>Click <strong>⇄</strong> (labeled &ldquo;Move to module/day&rdquo;) on the card.</DocStep>
          <DocStep number={2}>Pick a module from the dropdown, then a day. Days that already exist in that module appear as solid buttons; days that don&apos;t yet exist appear dashed and are created automatically when you pick them.</DocStep>
          <DocStep number={3}>Click <strong>Move</strong>.</DocStep>
          <DocP>
            The same module and day pickers are available inline at the top of an assignment&apos;s full-page view.
          </DocP>

          <DocH3>Duplicating Content</DocH3>
          <DocP>
            Modules, assignments, resources, and quizzes each have a copy icon that opens a{' '}
            <strong>Copy [item]</strong> popup:
          </DocP>
          <DocStep number={1}>Click the copy icon on the card.</DocStep>
          <DocStep number={2}>Choose <strong>This course</strong> or <strong>Another course</strong>, then pick the target module and day (or course).</DocStep>
          <DocStep number={3}>Click <strong>Duplicate</strong> (same course) or <strong>Copy to course</strong> (another course).</DocStep>
        </>
      ),
    },
    {
      id: 'publishing',
      title: 'Publishing and Unpublishing',
      content: (
        <>
          <DocP>
            Every content type has its own <strong>Published</strong> / <strong>Draft</strong> toggle — clicking it
            takes effect immediately, with no separate save step.
          </DocP>
          <DocList>
            <li><strong>Modules</strong> — toggle the switch on the module header. Students only see published modules; unpublishing hides the module and everything inside it right away, with no placeholder shown.</li>
            <li><strong>Assignments</strong> — toggle on the assignment card or in its full-page view. If the assignment doesn&apos;t require a submission, the same button reads <strong>Add to Gradebook</strong> / <strong>In Gradebook</strong> instead of Draft / Published.</li>
            <li><strong>Resources</strong> — each resource has its own Published / Draft toggle, independent of its sibling resources.</li>
            <li><strong>Quizzes</strong> and <strong>Wikis</strong> — same Published / Draft toggle pattern.</li>
          </DocList>
          <DocNote>
            Days themselves don&apos;t have a publish toggle — only the module they belong to controls whether
            students can see into that day at all.
          </DocNote>
        </>
      ),
    },
    {
      id: 'trash',
      title: 'Deleting Content and the Trash',
      content: (
        <>
          <DocP>
            Deleting a module, day, assignment, or resource moves it to the <strong>Trash</strong> rather than
            permanently removing it. Trashed items are hidden from students immediately but can be recovered.
          </DocP>
          <DocList>
            <li>Click the trash icon on any module, day, assignment, or resource in the Course Editor — you&apos;ll be asked to confirm first (e.g. &ldquo;Move &lsquo;X&rsquo; and all its days to trash?&rdquo;).</li>
            <li>Deleting a <strong>module</strong> also trashes all its days, assignments, and resources.</li>
            <li>Deleting a <strong>day</strong> also trashes all its assignments and resources.</li>
            <li>Assignments can also be trashed from the <strong>Move to trash</strong> button on the assignment&apos;s full-page view.</li>
            <li>Quizzes are trashed with the <strong>Delete quiz</strong> button on the quiz&apos;s own page.</li>
          </DocList>
          <DocNote>
            The quiz delete confirmation says &ldquo;This cannot be undone,&rdquo; but it isn&apos;t permanent — a
            deleted quiz still lands in Trash and can be restored like everything else below. Wikis are the one
            exception: as noted in the Wikis section above, deleting a wiki really is immediate and permanent, with
            no trash step at all.
          </DocNote>

          <DocH3>Trash Page</DocH3>
          <DocP>
            Access <strong>Trash</strong> at the bottom of the course sidebar. TAs don&apos;t see this link — Trash,
            like <strong>+ Create</strong>, is only available to instructors and admins. The trash page groups
            everything by type — Modules, Days, Assignments, Resources, and Quizzes — sorted newest-first, each
            showing when it was trashed and when it expires.
          </DocP>
          <DocList>
            <li><strong>Restore</strong> — puts the item back where it came from; restoring a module also restores its days and their assignments/resources, and restoring a day restores its assignments and resources. Restored quizzes always come back unpublished.</li>
            <li><strong>Delete</strong> — permanently removes just that item. This cannot be undone.</li>
            <li><strong>Empty trash</strong> — permanently deletes everything in the trash at once. This cannot be undone.</li>
          </DocList>
          <DocNote>
            Trashed items are purged automatically 7 days after being deleted, whether or not anyone visits the Trash
            page. Restore anything you want to keep before then.
          </DocNote>
          <DocTip>
            If you have items sitting in the trash, the sidebar shows an occasional prompt asking whether to{' '}
            <strong>Review trash</strong> or <strong>Empty trash</strong> — it appears at most once a week.
          </DocTip>
        </>
      ),
    },
  ]

  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Course Editor</h1>
      <p className="text-sm text-muted-text mb-8">Build and manage your course structure with modules, days, and assignments.</p>

      <DocAccordion items={items} />
    </>
  )
}
