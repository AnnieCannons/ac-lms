import { DocH2, DocH3, DocP, DocList, DocTip } from '@/components/docs/DocComponents'

export default function Resources() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Resources</h1>
      <p className="text-sm text-muted-text mb-8">Videos, readings, and links your instructor has attached to each day.</p>

      <DocH2>Resource Types</DocH2>
      <DocP>Your instructor can attach four types of resources to any day:</DocP>
      <DocList>
        <li><strong>Video</strong> — an embedded video or link to a video lesson</li>
        <li><strong>Reading</strong> — a written article, documentation page, or notes</li>
        <li><strong>Link</strong> — an external website or tool</li>
        <li><strong>File</strong> — a downloadable file (PDF, slides, etc.)</li>
      </DocList>

      <DocH2>Finding Resources</DocH2>
      <DocP>
        Resources appear on day detail pages inside the Course Outline. Open any day to see the resources attached to it.
        Resources are grouped under the day alongside assignments and quizzes.
      </DocP>

      <DocH2>Starring Resources</DocH2>
      <DocP>
        Click the <strong>star icon</strong> next to any resource to bookmark it. Starred resources are saved across
        sessions so you can quickly find important materials later.
      </DocP>
      <DocTip>
        Star resources you want to revisit — like reference docs, cheat sheets, or videos you plan to rewatch.
      </DocTip>

      <DocH2>Marking Resources Complete</DocH2>
      <DocP>
        You can check off resources as you work through them by clicking the <strong>checkmark</strong> button. This
        personal tracker helps you keep track of what you&apos;ve reviewed. It doesn&apos;t affect your grade.
      </DocP>

      <DocH3>Does My Instructor See This?</DocH3>
      <DocP>
        Stars and completion checkmarks are personal — only you see them. Your instructor cannot see which resources
        you&apos;ve starred or marked complete.
      </DocP>
    </>
  )
}
