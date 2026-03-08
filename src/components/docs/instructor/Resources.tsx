import { DocH2, DocH3, DocP, DocList, DocTip, DocStep } from '@/components/docs/DocComponents'

export default function Resources() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Managing Resources</h1>
      <p className="text-sm text-muted-text mb-8">Attach videos, readings, links, and files to any day in your course.</p>

      <DocH2>Resource Types</DocH2>
      <DocList>
        <li><strong>Video</strong> — paste a video URL; it embeds in the student view</li>
        <li><strong>Reading</strong> — a rich-text block or external reading link</li>
        <li><strong>Link</strong> — any external URL (tools, documentation, references)</li>
        <li><strong>File</strong> — upload a file for students to download (PDF, slides, etc.)</li>
      </DocList>

      <DocH2>Adding a Resource</DocH2>
      <DocStep number={1}>Expand the module and open the target day in the Course Editor.</DocStep>
      <DocStep number={2}>Click <strong>+ Add Resource</strong> in the day&apos;s resource panel.</DocStep>
      <DocStep number={3}>Choose the resource type from the dropdown.</DocStep>
      <DocStep number={4}>Fill in the title and the URL or content.</DocStep>
      <DocStep number={5}>Click <strong>Save</strong>. The resource appears immediately in the list.</DocStep>

      <DocTip>
        Add a clear, descriptive title so students know what they&apos;re opening before they click.
      </DocTip>

      <DocH2>Editing a Resource</DocH2>
      <DocP>
        Click the <strong>Edit</strong> (pencil) icon next to any resource to update its title, URL, or content. Changes
        are saved immediately.
      </DocP>

      <DocH2>Deleting a Resource</DocH2>
      <DocP>
        Click the <strong>Delete</strong> (trash) icon next to a resource to remove it. There is no undo, so confirm
        before deleting.
      </DocP>

      <DocH2>Reordering Resources</DocH2>
      <DocP>
        Drag resources up or down within a day using the grip handle on the left. The order students see matches the order
        in the editor.
      </DocP>

      <DocH3>Are Resources Always Visible to Students?</DocH3>
      <DocP>
        Resources are visible to enrolled students as long as the module containing the day is published. There is no
        separate publish toggle for individual resources — publishing the module makes all its resources available.
      </DocP>
    </>
  )
}
