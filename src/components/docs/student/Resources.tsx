import { DocH3, DocP, DocList, DocTip, DocStep } from '@/components/docs/DocComponents'
import { DocAccordion } from '@/components/docs/DocAccordion'

export default function Resources() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Resources</h1>
      <p className="text-sm text-muted-text mb-8">Videos, readings, links, and files your instructor has attached to the course.</p>

      <DocAccordion
        items={[
          {
            id: 'types',
            title: 'Resource Types',
            content: (
              <>
                <DocP>Your instructor can attach four types of resources to any day:</DocP>
                <DocList>
                  <li><strong>Video</strong> — a link to a video lesson; opens in a new browser tab</li>
                  <li><strong>Reading</strong> — a written article or instructor notes; click it to expand the content right on the page</li>
                  <li><strong>Link</strong> — an external website or tool; opens in a new browser tab</li>
                  <li><strong>File</strong> — a downloadable file such as a PDF or slides; opens in a new browser tab</li>
                </DocList>
                <DocP>
                  Video, Link, and File resources sometimes include a short description underneath the title to give you
                  more context before you click.
                </DocP>
              </>
            ),
          },
          {
            id: 'finding',
            title: 'Finding Resources',
            content: (
              <>
                <DocP>Resources show up in two places:</DocP>

                <DocH3>Course Outline</DocH3>
                <DocStep number={1}>Open a course — the Course Outline is the default view, organized by week.</DocStep>
                <DocStep number={2}>Click a module to expand it, then click a day to expand it in place.</DocStep>
                <DocStep number={3}>
                  The day&apos;s <strong>Resources</strong> appear alongside any Wikis, Assignments, and Quizzes for that
                  day. Click a reading to expand it; click a video, link, or file to open it in a new tab.
                </DocStep>
                <DocP>
                  You can also type into the search bar at the top of the Course Outline to search modules, days,
                  assignments, and resources at once. A matching resource shows an <strong>Open ↗</strong> link if it has
                  a URL, or a <strong>View →</strong> link that jumps you straight to its day.
                </DocP>

                <DocH3>Class Resources (sidebar)</DocH3>
                <DocStep number={1}>Click <strong>Class Resources</strong> in the left sidebar.</DocStep>
                <DocStep number={2}>
                  Browse every resource in the course, organized by module and day — including material from{' '}
                  <strong>Career Development</strong> and <strong>Level Up Your Skills</strong>, not just the main
                  Course Outline.
                </DocStep>
                <DocStep number={3}>
                  Use the <strong>Search resources…</strong> bar to filter by title, or the <strong>Expand All</strong> /{' '}
                  <strong>Collapse All</strong> toggle in the top corner to open or close every module at once.
                </DocStep>

                <DocTip>
                  Use <strong>Class Resources</strong> when you want to browse everything at once — helpful for
                  reviewing materials before a project or revisiting something from a previous week. A resource
                  cross-posted from Career Development shows a purple <strong>Career Dev</strong> badge wherever it
                  appears.
                </DocTip>
              </>
            ),
          },
          {
            id: 'tracking',
            title: 'Tracking Your Progress',
            content: (
              <>
                <DocP>Each resource row has two small icon buttons you can use to keep track of it personally:</DocP>
                <DocStep number={1}>
                  Click the <strong>star</strong> icon to bookmark a resource. Click it again to remove the star.
                  Starred resources are saved across sessions, so you can quickly find important materials later —
                  reference docs, cheat sheets, or videos you plan to rewatch.
                </DocStep>
                <DocStep number={2}>
                  Click the <strong>circle checkmark</strong> icon to mark a resource as read. Click it again to mark
                  it unread. This is a personal tracker to help you keep track of what you&apos;ve reviewed — it
                  doesn&apos;t affect your grade.
                </DocStep>

                <DocH3>Does My Instructor See This?</DocH3>
                <DocP>
                  Stars and read/unread marks are completely private — only you see them. Your instructor cannot see
                  which resources you&apos;ve starred or marked as read.
                </DocP>
              </>
            ),
          },
        ]}
      />
    </>
  )
}
