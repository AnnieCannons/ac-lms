import { DocH3, DocP, DocList, DocOL, DocTip, DocNote, DocStep, DocCode } from '@/components/docs/DocComponents'
import { DocAccordion } from '@/components/docs/DocAccordion'

export default function Courses() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Course Outline</h1>
      <p className="text-sm text-muted-text mb-8">Navigate your course week by week.</p>

      <DocAccordion
        items={[
          {
            id: 'your-courses-list',
            title: 'Your Courses List',
            content: (
              <>
                <DocP>
                  After logging in you land on <strong>My Courses</strong> — every course you&apos;re enrolled in. A
                  green <strong>Current</strong> badge marks courses that are actively running right now, and current
                  courses are sorted to the top of the list.
                </DocP>
                <DocP>
                  If you&apos;re a <strong>Teaching Assistant (TA)</strong> for a course, that course shows a blue{' '}
                  <strong>TA</strong> badge. The <strong>View →</strong> link for a TA course takes you into the
                  instructor side of the course instead of the student side, so you can grade and manage it.
                </DocP>
                <DocTip>
                  From the instructor side of a TA course, use the <strong>Student View</strong> button in the sidebar
                  to preview the course exactly as a student would. Click <strong>Leave Student View</strong> to go
                  back to grading.
                </DocTip>
                <DocOL>
                  <li>Go to <strong>My Courses</strong> (click the <DocCode>AC*</DocCode> logo, top left, from anywhere).</li>
                  <li>Find the course you want and click its name, or click <strong>View →</strong> on the right.</li>
                </DocOL>
              </>
            ),
          },
          {
            id: 'modules-search',
            title: 'Modules, Weeks, and Search',
            content: (
              <>
                <DocP>
                  Inside a course, the <strong>Course Outline</strong> is organized into <strong>modules</strong>,
                  each representing one week of content. Modules are collapsible — click a module&apos;s header row to
                  expand or collapse it.
                </DocP>
                <DocTip>
                  The module for the current week is automatically highlighted with a teal &ldquo;Current Week&rdquo;
                  badge and starts expanded, so you always know where you are in the course. A{' '}
                  <strong>Week&nbsp;N this week</strong> pill next to the page title jumps straight to it.
                </DocTip>
                <DocP>
                  If there&apos;s more than one module, <strong>Expand all</strong> / <strong>Collapse all</strong>{' '}
                  links appear above the list so you don&apos;t have to open every module one at a time.
                </DocP>
                <DocH3>Searching the Outline</DocH3>
                <DocP>
                  Use the search box at the top of the Course Outline (placeholder text: &ldquo;Search modules, days,
                  assignments, resources…&rdquo;) to jump straight to something instead of scrolling through every
                  module:
                </DocP>
                <DocStep number={1}>Start typing a module name, day name, assignment title, resource title, or quiz title.</DocStep>
                <DocStep number={2}>
                  Matching results appear in a flat list below the search box, each labeled with what it is (module,
                  day, assignment, resource, or quiz) and which module/day it lives in.
                </DocStep>
                <DocStep number={3}>
                  Click a result: assignments and resources open a <strong>View →</strong> (or <strong>Open ↗</strong>{' '}
                  for links) action directly; clicking a day result jumps to that day and expands it inline in the
                  outline.
                </DocStep>
                <DocStep number={4}>Clear the search box to return to the normal module list.</DocStep>
              </>
            ),
          },
          {
            id: 'day-cards',
            title: 'Day Cards',
            content: (
              <>
                <DocP>
                  Inside each module you&apos;ll see a row for each day (Monday–Thursday). Click a day&apos;s row to
                  expand it in place — it does not navigate you to a new page. While collapsed, a day with content
                  shows a quick count like &ldquo;2 assignments · 1 resource · 1 quiz&rdquo;; the current day is
                  marked with a teal <strong>Today</strong> label.
                </DocP>
                <DocP>Once expanded, a day can contain any of the following, in this order:</DocP>
                <DocList>
                  <li><strong>Wikis</strong> — reference pages your instructor has written directly into the course, like setup guides or glossaries. Click a wiki&apos;s title to expand it.</li>
                  <li>
                    <strong>Resources</strong> — videos, readings, links, and files. Reading resources expand inline
                    when you click them; other resource types open in a new tab. Each resource has a star icon (save
                    it to your favorites) and a check icon (mark it read/complete) — click either to toggle it.
                  </li>
                  <li>
                    <strong>Assignments</strong> — each shows its title, due date, a status badge (see below), and a{' '}
                    <strong>View →</strong> link to the full assignment page. Bonus assignments carry a purple{' '}
                    <strong>Bonus</strong> badge; some assignments also show skill tags describing what they cover.
                  </li>
                  <li>
                    <strong>Quizzes</strong> — click <strong>Take →</strong> to open it. This always says{' '}
                    <strong>Take →</strong> on the day card itself; once you&apos;re on the quiz page it shows your
                    actual status and, if you&apos;ve already submitted, offers <strong>Retake</strong> (while
                    attempts remain) or your results (once you&apos;ve used all your attempts).
                  </li>
                </DocList>
                <DocNote>
                  A day with nothing scheduled yet just says &ldquo;Nothing scheduled for this day yet.&rdquo; when
                  expanded — that&apos;s normal, not an error.
                </DocNote>
                <DocP>
                  Below the module list, a &ldquo;Done with today&apos;s work?&rdquo; banner links to{' '}
                  <strong>Level Up Your Skills</strong> for extra, optional challenges.
                </DocP>
              </>
            ),
          },
          {
            id: 'assignment-status',
            title: 'Assignment Status Badges',
            content: (
              <>
                <DocP>
                  Each assignment on a day card shows a status badge so you can tell where things stand without
                  opening it:
                </DocP>
                <DocList>
                  <li><strong>Not Started</strong> — you haven&apos;t submitted anything yet</li>
                  <li><strong>Late</strong> — shown next to Not Started once the due date has passed and you still haven&apos;t submitted</li>
                  <li><strong>Turned In</strong> — you submitted, and your instructor hasn&apos;t graded it yet</li>
                  <li><strong>Needs Revision</strong> — your instructor graded it and it needs more work</li>
                  <li><strong>Complete ✓</strong> — your instructor graded it as complete</li>
                </DocList>
              </>
            ),
          },
          {
            id: 'published-content',
            title: 'Published vs. Unpublished Content',
            content: (
              <>
                <DocP>
                  Only <strong>published</strong> modules and assignments are visible to students. Your instructor
                  controls what is published and when. If you expect to see content that isn&apos;t there yet, it
                  likely hasn&apos;t been published — check with your instructor.
                </DocP>
                <DocNote>
                  Unpublished modules and assignments are completely hidden. You won&apos;t see a placeholder — they
                  simply won&apos;t appear until your instructor publishes them.
                </DocNote>
              </>
            ),
          },
          {
            id: 'career-dev',
            title: 'Career Dev Content',
            content: (
              <>
                <DocP>
                  Some assignments, resources, and quizzes are tagged with a purple <strong>Career Dev</strong> badge.
                  These items are part of your career development curriculum — things like resume workshops,
                  portfolio prep, or job-search resources. Your instructor has placed them on your day cards so you
                  don&apos;t miss them. They work exactly like any other assignment, resource, or quiz; the badge is
                  just a label.
                </DocP>
                <DocP>
                  Career Dev content also has its own dedicated <strong>Career Development</strong> section in the
                  sidebar where all career-related work is organized in one place.
                </DocP>
              </>
            ),
          },
          {
            id: 'course-info',
            title: 'Course Information and Syllabus',
            content: (
              <>
                <DocP>
                  Click <strong>General Info</strong> in the sidebar to open the course info page. It&apos;s a list of
                  collapsible sections your instructor has published — things like the course schedule, policies, and
                  other course-level information.
                </DocP>
                <DocStep number={1}>
                  Click the <strong>Syllabus</strong> button at the top right of the Course Outline.
                </DocStep>
                <DocStep number={2}>
                  You&apos;re taken to <strong>General Info</strong>, scrolled straight to the course outline/syllabus
                  section.
                </DocStep>
                <DocStep number={3}>
                  Click any section&apos;s header to expand or collapse it, or use <strong>Expand all</strong> /{' '}
                  <strong>Collapse all</strong> above the list if there&apos;s more than one section.
                </DocStep>
              </>
            ),
          },
        ]}
      />
    </>
  )
}
