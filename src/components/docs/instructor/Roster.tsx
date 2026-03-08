import { DocH2, DocH3, DocP, DocList, DocTip } from '@/components/docs/DocComponents'

export default function Roster() {
  return (
    <>
      <h1 className="text-2xl font-bold text-dark-text mb-1">Roster & Student Progress</h1>
      <p className="text-sm text-muted-text mb-8">Track individual student progress and accommodation needs.</p>

      <DocH2>The Accommodation Roster</DocH2>
      <DocP>
        Navigate to <strong>Roster</strong> in the course sidebar to see the accommodation roster. This page lists
        students who have accommodation notes or flags on their profile — useful for instructors coordinating with
        accessibility services.
      </DocP>

      <DocH2>Student Progress Overview</DocH2>
      <DocP>
        Click any student&apos;s name in the roster to open their <strong>Student Detail View</strong>. This page
        shows a breakdown of their assignment status across the entire course:
      </DocP>
      <DocList>
        <li><strong>Missing</strong> — assignments that are past due with no submission</li>
        <li><strong>Late</strong> — submissions received after the due date</li>
        <li><strong>Complete</strong> — graded as complete</li>
        <li><strong>Needs Revision</strong> — graded as needing revision</li>
        <li><strong>Submitted</strong> — submitted but not yet graded</li>
      </DocList>

      <DocTip>
        Use the student detail view during 1-on-1 check-ins to quickly see where a student is falling behind.
      </DocTip>

      <DocH3>Assignment Cards</DocH3>
      <DocP>
        Each assignment appears as a card in the appropriate category column. Click a card to navigate directly to that
        assignment&apos;s submission for grading or review.
      </DocP>

      <DocH2>Who Appears on the Roster?</DocH2>
      <DocP>
        The roster shows all students with an active enrollment in the course. Students on observer status also appear
        but are labeled with their observer role.
      </DocP>

      <DocH2>Linking from Roster to Student Detail</DocH2>
      <DocP>
        Student names on the roster page are clickable links that open the student detail view at
        <strong> /roster/[student-id]</strong>. You can share this URL directly with another instructor or TA.
      </DocP>
    </>
  )
}
