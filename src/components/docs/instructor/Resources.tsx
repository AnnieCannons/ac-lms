import { DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'
import { DocAccordion } from '@/components/docs/DocAccordion'

export default function Resources() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Managing Resources</h1>
      <p className="text-sm text-muted-text mb-8">Attach videos, readings, links, and files to any day in your course.</p>

      <DocAccordion
        items={[
          {
            id: 'types',
            title: 'Resource Types',
            content: (
              <>
                <DocList>
                  <li><strong>Link</strong> — any external URL (tools, documentation, references); opens in a new tab for students</li>
                  <li><strong>Video</strong> — a link to a video; opens in a new tab, same as Link. It does not embed a player on the page.</li>
                  <li><strong>Reading</strong> — a rich-text block you write directly in the editor; students click it to expand the content in place</li>
                  <li><strong>File</strong> — upload a file for students to download (PDF, slides, etc.). If the file is an image, the editor shows a small thumbnail preview instead of a plain link.</li>
                </DocList>
                <DocP>
                  Every resource can also have an optional <strong>Description</strong> — a short line shown under the title. In the
                  Course Editor it displays under any resource type, including Reading. In the student-facing views (Course Outline,
                  Class Resources), it only shows for Video, Link, and File — Reading resources never display a description there,
                  even if you&apos;ve set one.
                </DocP>
              </>
            ),
          },
          {
            id: 'adding',
            title: 'Adding a Resource',
            content: (
              <>
                <DocP>The fastest way is directly on the day you want it on:</DocP>
                <DocStep number={1}>On the day&apos;s header, open the <strong>+ Add ▾</strong> menu and click <strong>Resource</strong>.</DocStep>
                <DocStep number={2}>An inline form opens in the day panel. Pick a type from the dropdown (<strong>Link</strong>, <strong>Video</strong>, <strong>Reading</strong>, or <strong>File</strong>) and enter a title.</DocStep>
                <DocStep number={3}>
                  Fill in the content: a URL for Link or Video, an uploaded file for File, or the rich-text editor for Reading.
                </DocStep>
                <DocStep number={4}>Click <strong>Add</strong>. The resource appears in the day&apos;s panel immediately, published by default.</DocStep>

                <DocNote>
                  This quick form doesn&apos;t include a Description field — add one afterward by editing the resource.
                </DocNote>

                <DocH3>From the Sidebar</DocH3>
                <DocP>
                  You can also use the <strong>+ Create</strong> button in the course sidebar if you want to add a resource to a
                  different module or day than the one you&apos;re looking at, or create a brand-new module for it. Pick{' '}
                  <strong>Resource</strong> as the type, choose a Section, Module, and optional Day, then a resource Type, Title,
                  and URL, and click <strong>Create →</strong>. See <strong>Course Editor → Adding Content</strong> for the full
                  walkthrough of that modal.
                </DocP>
                <DocNote>
                  The sidebar modal only offers a plain URL field for the content — even when Type is set to Reading. For a
                  rich-text reading, add it directly on the day instead, or create it via the modal and switch to the rich-text
                  editor afterward when you edit it.
                </DocNote>
              </>
            ),
          },
          {
            id: 'editing',
            title: 'Editing a Resource',
            content: (
              <>
                <DocStep number={1}>
                  Click the resource&apos;s title to open its inline edit fields. For Link resources, click the small pencil (✎)
                  icon next to the title instead — the title itself is a live link there.
                </DocStep>
                <DocStep number={2}>Change the Type, Title, or content as needed, and add or update the optional Description.</DocStep>
                <DocStep number={3}>Click <strong>Save</strong>, or <strong>Cancel</strong> to discard your changes.</DocStep>
                <DocP>
                  Changes save immediately — there&apos;s no separate publish step for edits.
                </DocP>
              </>
            ),
          },
          {
            id: 'reordering',
            title: 'Reordering, Moving, and Copying',
            content: (
              <>
                <DocP>Drag a resource by its grip handle (⠿) to reorder it within a day, or drop it on a different day to move it there.</DocP>
                <DocP>To move a resource to a distant week without a long drag, use the <strong>⇄</strong> button on its card:</DocP>
                <DocStep number={1}>Click <strong>⇄</strong> (labeled &ldquo;Move to module/day&rdquo;).</DocStep>
                <DocStep number={2}>Pick a module, then a day — days that don&apos;t exist yet in that module appear dashed and are created automatically when you pick them.</DocStep>
                <DocStep number={3}>Click <strong>Move</strong>.</DocStep>
                <DocP>To copy a resource instead of moving it, use the copy icon on its card (labeled &ldquo;Copy resource&rdquo;):</DocP>
                <DocStep number={1}>Click the copy icon.</DocStep>
                <DocStep number={2}>Choose <strong>This course</strong> or <strong>Another course</strong>, then pick the target module and day (or course, module, and day).</DocStep>
                <DocStep number={3}>Click <strong>Copy</strong>.</DocStep>
                <DocNote>
                  A copied resource is always created as a <strong>Draft</strong>, even if the original was published — review and
                  publish it in its new location when you&apos;re ready.
                </DocNote>
              </>
            ),
          },
          {
            id: 'publishing',
            title: 'Publishing and Student Visibility',
            content: (
              <>
                <DocP>
                  Each resource has its own <strong>Published</strong> / <strong>Draft</strong> toggle on its card, independent of
                  its sibling resources — clicking it takes effect immediately. New resources are published by default.
                </DocP>
                <DocP>
                  A resource is visible to students only when <strong>both</strong> are true: the resource itself is set to
                  Published, <strong>and</strong> the module containing its day is published. Unpublishing either one hides it.
                </DocP>
                <DocTip>
                  If a resource isn&apos;t showing up for students and its own toggle already reads Published, check whether the
                  module is published — see <strong>Course Editor → Publishing and Unpublishing</strong>.
                </DocTip>
              </>
            ),
          },
          {
            id: 'deleting',
            title: 'Deleting a Resource',
            content: (
              <DocP>
                Click the <strong>trash icon</strong> on a resource and confirm to move it to the Trash. Trashed resources are
                hidden from students immediately but can be restored from the <strong>Trash</strong> page at the bottom of the
                course sidebar. See <strong>Course Editor → Deleting Content and the Trash</strong> for details.
              </DocP>
            ),
          },
          {
            id: 'resource-pages',
            title: 'Class Resources and Instructor Resources Pages',
            content: (
              <>
                <DocP>
                  Two links in the course sidebar&apos;s <strong>Course</strong> section give you a course-wide view of
                  resources instead of scrolling through the Course Editor module by module.
                </DocP>

                <DocH3>Class Resources</DocH3>
                <DocStep number={1}>Click <strong>Class Resources</strong> in the sidebar.</DocStep>
                <DocStep number={2}>Browse every non-instructor-only resource in the course, grouped by module and then by day.</DocStep>
                <DocStep number={3}>
                  Use the <strong>Search resources…</strong> box to filter by title, or <strong>Expand All ▾</strong> /{' '}
                  <strong>Collapse All ▴</strong> to open or close every module at once.
                </DocStep>
                <DocP>
                  Hover a resource to reveal edit and delete icons; editing here opens an <strong>Edit Resource</strong> modal
                  (Title, Type, URL, Description) rather than the inline fields you&apos;d see in the Course Editor.
                </DocP>

                <DocH3>Instructor Resources</DocH3>
                <DocP>
                  A separate page for resources you never want students to see — course policies, answer keys, internal notes.
                  The page itself says: &ldquo;Only visible to instructors, admins, and TAs — never shown to students.&rdquo;
                </DocP>
                <DocStep number={1}>Click <strong>Instructor Resources</strong> in the sidebar.</DocStep>
                <DocStep number={2}>Click <strong>+ Add resource</strong>.</DocStep>
                <DocStep number={3}>Choose a Module and optional Day, a Type, a Title, and a URL, then click <strong>Create →</strong>.</DocStep>
                <DocNote>
                  Resources added this way are flagged instructor-only and stay hidden from students regardless of their own
                  Published/Draft state. But they&apos;re stored like any other resource in that day — they&apos;ll also show up
                  in the Course Editor&apos;s day panel with no special badge, so it&apos;s easy to lose track of which ones are
                  instructor-only. Use this page, not the Course Editor, to check which resources are actually hidden from
                  students.
                </DocNote>
              </>
            ),
          },
        ]}
      />
    </>
  )
}
