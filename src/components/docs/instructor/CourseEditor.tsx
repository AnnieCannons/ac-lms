import { DocH2, DocH3, DocP, DocList, DocTip, DocNote, DocStep } from '@/components/docs/DocComponents'

export default function CourseEditor() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Course Editor</h1>
      <p className="text-sm text-muted-text mb-8">Build and manage your course structure with modules, days, and assignments.</p>

      <DocH2>Module and Day Structure</DocH2>
      <DocP>
        Your course is organized into <strong>modules</strong> containing <strong>days</strong> (typically Monday–Thursday).
        Each day can hold assignments and resources. The Course Editor displays all modules in a collapsible list.
      </DocP>
      <DocList>
        <li>Click a module header to expand or collapse it</li>
        <li>Modules show their publish status (published / unpublished)</li>
        <li>Each day panel inside a module contains its assignments and a resource manager</li>
      </DocList>

      <DocH2>Drag-and-Drop Reordering</DocH2>
      <DocP>
        You can reorder content by dragging:
      </DocP>
      <DocList>
        <li><strong>Modules</strong> — drag a module by its handle to change week order</li>
        <li><strong>Days</strong> — drag a day panel within a module to reorder days</li>
        <li><strong>Assignments</strong> — drag an assignment to a different day (cross-day moves supported)</li>
        <li><strong>Resources</strong> — drag a resource up or down within a day</li>
      </DocList>
      <DocTip>
        Grab the grip handle (⠿) on the left of any item to drag it. The item highlights when it&apos;s ready to be
        dropped.
      </DocTip>

      <DocH2>Publishing and Unpublishing</DocH2>
      <DocH3>Modules</DocH3>
      <DocP>
        Toggle the <strong>Published</strong> switch on a module header to publish or unpublish the entire module. Students
        only see published modules.
      </DocP>
      <DocNote>
        Unpublishing a module hides it from students immediately — they won&apos;t see a placeholder.
      </DocNote>

      <DocH3>Assignments</DocH3>
      <DocP>
        Each assignment has its own publish toggle. You can publish or unpublish individual assignments without affecting
        the rest of the day or module.
      </DocP>

      <DocH2>Adding Content via the Create Button</DocH2>
      <DocP>
        The <strong>+ Create</strong> button in the course sidebar is the fastest way to add assignments, resources, or
        quizzes. It lets you pick the type, choose a module and day, and — if needed — create a new module on the spot.
        When your course has both coding and Career Dev modules, a <strong>Section</strong> dropdown lets you direct the
        item to the right place. See <strong>Career Development</strong> in the docs for cross-posting options.
      </DocP>

      <DocH2>Collapsing All Modules</DocH2>
      <DocP>
        Use the <strong>Collapse All</strong> button at the top of the Course Editor to fold every module at once,
        giving you a compact overview of all weeks. Click any module to expand it individually.
      </DocP>

      <DocH2>Deleting Content (Trash)</DocH2>
      <DocP>
        Deleting a module, day, assignment, resource, or quiz moves it to the <strong>Trash</strong> rather than
        permanently removing it. Trashed items are hidden from students immediately but can be recovered at any time.
      </DocP>
      <DocList>
        <li>Click the <strong>trash icon</strong> on any module, day, assignment, or resource in the Course Editor to move it to trash — you&apos;ll be asked to confirm first</li>
        <li>Deleting a <strong>module</strong> also trashes all its days, assignments, and resources</li>
        <li>Deleting a <strong>day</strong> also trashes all its assignments and resources</li>
        <li>Quizzes can be trashed from the Quizzes page in the sidebar</li>
        <li>Assignments can also be trashed directly from the <strong>Edit Assignment</strong> page using the <strong>Move to trash</strong> button</li>
      </DocList>

      <DocH3>Trash Page</DocH3>
      <DocP>
        Access the <strong>Trash</strong> link at the bottom of the course sidebar (instructors only). The trash page shows
        all trashed items grouped by type — Modules, Days, Assignments, Resources, and Quizzes — sorted
        newest-first.
      </DocP>
      <DocList>
        <li><strong>Restore</strong> — moves the item back to its original location in the course; modules restore their days and assignments; days restore their assignments; quizzes restore as unpublished</li>
        <li><strong>Delete forever</strong> — permanently removes the item; this cannot be undone</li>
        <li><strong>Empty trash</strong> — permanently deletes everything in the trash at once</li>
      </DocList>
      <DocNote>
        Restored quizzes are always unpublished — review and re-publish them from the Quizzes page when you&apos;re ready.
      </DocNote>
      <DocTip>
        If you accidentally delete something, go to Trash immediately and restore it before emptying the trash.
      </DocTip>
    </>
  )
}
