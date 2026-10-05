# Spec for Growing and Maintaining Skills

branch: claude/feature/growing-maintaining-skills

figma-component (if used): n/a

## Summary
Replaces the "mastered" idea in Confidence Tracker v2 with a simpler, more forgiving one. Today a skill is "mastered" after its student rates it 10 twice; it then disappears from assignments and can only come back through a "Reactivate" control. Instead, a student's skills are in one of two states, based only on the latest rating:

- **Growing**: the latest rating is below 10.
- **Maintaining**: the latest rating is 10.

My Skill Confidence has two sections, "Skills you're growing" and "Skills you're maintaining". A skill that is maintained keeps appearing on assignments, shown at 10, and the student can lower the rating whenever it no longer feels true. Doing so moves the skill back to Growing and the normal goal flow applies again. Nothing is ever deleted: every earlier rating stays in the chart and in the history.

This reverses the Phase 3 decision that a skill stops appearing after two 10s, and removes mastery, the second-10 celebration, reactivation and the permanent "maintain" goal. The feature stays behind `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED`, which is off in production and stays off until every phase is done.

## Functional Requirements

### Which section a skill is in
- A skill is Maintaining when the student's latest rating of it is 10; otherwise it is Growing. This is worked out from the ratings alone, so a skill can move either way and nothing needs to be stored for it.
- A skill that has a goal and is below 10 behaves as before (open goal, "Set a goal" when none or the last one was reached).
- Existing skills that are currently "mastered" appear in Maintaining, because their latest rating is 10. No data is changed or migrated for this.

### My Skill Confidence page (student)
- The two sections are titled "Skills you're growing" and "Skills you're maintaining", each with a short description, a searchable skill picker, its own empty-state wording, and the same skill cards as today.
- The "Mastered" note, the "Previously mastered / reactivated" note, the Reactivate control and its confirmation dialog are removed.
- A skill in Maintaining has no goal panel to act on; the card says the student is maintaining this rating. It has no "Set a goal" control.
- When a rating below 10 moves a skill from Maintaining to Growing, the card shows the normal goal panel again, with "Set a goal" available, as for any skill with no open goal.
- The student-only controls (set a goal, log what helped) keep working exactly as today; staff previewing the page still see them disabled.

### Chart and history
- The chart shows rating points only. The "Mastered" and "Reactivated" markers are removed. Course dividers and goal markers stay as they are.
- Earlier ratings, goals and "what helped" answers are kept and shown exactly as before; moving between sections never hides or changes history.
- Old mastery and reactivation records in the database are left in place and simply no longer used. No migration is needed.

### Submission form (first submission of an assignment)
- Every tagged skill still appears, including skills the student is maintaining; nothing is hidden because of earlier 10s.
- Skills the student is maintaining are grouped in one collapsed row, for example "Still feeling confident on: HTML, Git", with a way to expand it and change any of those ratings. Skills in Growing, and skills never rated, appear as separate rating boxes as they do today.
- Inside the expanded row each maintained skill is shown already at 10.
- If the student does not touch a maintained skill, nothing is saved for it: no new rating, no kudos, no celebration. Ratings stay optional and stay the student's own.
- If the student chooses a lower rating for a maintained skill, that rating is saved like any other, the skill moves to Growing, and the normal goal flow is offered (goal, target date, study plan), because the skill now has no current goal.
- If the student explicitly chooses 10 again on a maintained skill, it is saved as a rating of 10 like any other (a student who wants a fresh data point can have one).
- A skill's first rating still shows the "New" badge only for a skill never rated before.

### Goal rules
- The "maintaining this rating" goal is no longer stored or shown as a goal. Maintaining is only the state of a skill at 10.
- A goal can be set for any skill whose latest rating is below 10 and that has no open goal, including right after a dip from 10. The server enforces this too, so a skill that dipped below 10 is not blocked by an earlier "maintaining" goal.
- A numeric goal still needs a target date and a study plan, still must be above the current rating, and is still capped at 10.

### Celebrations and kudos
- Reaching a numeric goal of 10 shows the goal-met celebration and asks "what helped", as today for any met goal.
- Getting back to 10 after a dip (a rating below 10 followed by a 10) asks "what helped" even when no goal or study plan was set for that skill. This is recorded the same way as other "what helped" answers, can be skipped for now, and appears as a follow-up and a bell reminder like any unanswered one.
- A first-ever rating of 10 with no goal shows a short celebration with no "what helped" question.
- The second-10 mastery celebration no longer exists.
- Kudos ("from 4 to 6") still shows for any increase over the previous rating, except when the increase reaches 10: then the 10 celebration replaces the kudos, so the student sees one message, not two.
- A rating that stays at 10 (for example an explicit 10 on a maintained skill) shows no kudos and no celebration.
- Everything stays one-time and unstored beyond what already exists (kudos are not stored; a reached goal is recorded once).

### What is removed
- The count of 10s and the "mastered" state, the second-10 celebration, the Reactivate action and dialog, the "pending new after reactivation" state, the permanent "maintain" goal, and the rule that hides mastered skills from assignments.
- The Mastered and Reactivated chart markers.
- Older database columns and event rows for these stay unused; nothing is dropped.

### Not changed
- Skill tagging, the 1 to 10 scale and tooltips, the "New" badge rule, goal and study-plan rules, the "what helped" options, the Patterns tabs, the bell and its Clear option, and the access rules (staff read-only, TAs excluded).
- The instructor Skill Confidence page keeps its Class overview, By student and Patterns tabs. It should only change where it relies on the removed mastered or reactivation ideas (see Open Questions).

### Roadmap
- Add this as a new idea entry in `_plans/confidence-tracker-v2-roadmap.md` under "Ideas for later". Do not rewrite or remove any phase section or the earlier "third section" idea.

## Possible Edge Cases
- A student rates a skill 10, then 7, then 10 again: it moves Maintaining, Growing, Maintaining, and the return to 10 asks "what helped" even with no goal.
- A student at 10 on a maintained skill leaves it untouched on every submission: no new ratings are written, the skill stays in Maintaining, and the chart does not gain points.
- A student with an open numeric goal who reaches 10 gets the goal-met celebration; the skill moves to Maintaining and the goal moves to the goal history as today.
- A student drops a maintained skill to a lower rating and sets no goal: the skill is in Growing with "no goal set yet" and can set one later from My Skill Confidence.
- A skill that was mastered and reactivated in earlier test data: its latest rating decides its section; any leftover "new pending" flag is ignored.
- A skill whose only rating is a first-ever 10: it is Maintaining at once and gets the short celebration.
- An assignment tagged with many skills the student maintains: they stay in one collapsed row so the form does not grow longer.
- A maintained skill the student expands but does not change: still nothing is saved.
- Student Preview and observer mode show the same form and cannot save, as today.
- A student with no ratings at all still sees the "No skill ratings yet" state.
- Old goals recorded as "maintaining this rating" appear in the goal history without being treated as a current goal.
- Entered-but-unsubmitted ratings kept across in-app navigation (as today) must not turn an untouched maintained skill into a saved rating.

## Acceptance Criteria
- My Skill Confidence shows "Skills you're growing" and "Skills you're maintaining"; no "Mastered" wording, Reactivate control or reactivation dialog remains anywhere on it.
- A skill with a latest rating of 10 is in Maintaining; any other skill is in Growing; a dip below 10 moves a skill back to Growing and a return to 10 moves it to Maintaining.
- The chart shows rating points with course dividers and goal markers, and no Mastered or Reactivated markers; all earlier ratings remain visible.
- On the submission form a maintained skill is in one collapsed "Still feeling confident on" row, shown at 10; submitting without touching it saves nothing for that skill.
- Choosing a lower rating for a maintained skill saves it, moves the skill to Growing and offers the goal flow; the server does not reject a new goal because of an old "maintaining" goal.
- Reaching 10 through a numeric goal shows the goal-met celebration and asks "what helped"; returning to 10 after a dip asks "what helped" even with no goal or study plan; a first-ever 10 shows a short celebration with no question.
- A rise to 10 shows the 10 celebration and not the kudos card; other increases still show kudos; a rating that stays at 10 shows neither.
- A skill is no longer hidden from assignments after two 10s.
- No migration is added and no database column or row is deleted.
- The roadmap has one new idea entry and no existing phase text is changed.
- With the flag off, nothing about this feature is visible, as before.

## Open Questions
- Does the instructor By student view (and its skill cards) rely on the mastered or reactivated state anywhere, and if so how should it read once those are gone?
- When a student expands the "Still feeling confident on" row and picks a lower rating, should the goal fields appear right there in that skill's box, as for any Growing skill, or only after submitting?
- Should the short celebration for a first-ever 10 with no goal be shown again if the student later dips and returns to 10, or is the "what helped" version at that point the only one?
- The "what helped" list includes the student's own study-plan write-in as an extra choice. For a return to 10 with no study plan, nothing extra is offered; is that acceptable?
- Once nothing is "mastered", should "Maintaining" skills on the My Skill Confidence page offer anything beyond viewing history (for example, a note encouraging the student to lower the rating if it no longer feels true)?

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- Section rule: latest rating 10 is Maintaining, below 10 is Growing; 10 then 7 moves back to Growing; 10, 7, 10 returns to Maintaining; an old mastered skill with latest rating 10 is Maintaining.
- A maintaining goal from earlier no longer blocks setting a numeric goal once the latest rating is below 10 (trend data and the set-a-goal server action), and still blocks it at 10.
- Submission form: maintained skills are in one collapsed row at 10; untouched maintained skills are not sent for saving; a lower rating on a maintained skill is saved; an explicit 10 is saved.
- Celebration and kudos rules: goal reached at 10 gives the goal-met celebration with "what helped"; return to 10 after a dip asks "what helped" with no goal; first-ever 10 with no goal gives the short celebration without the question; a rise to 10 shows no kudos; other rises still do; staying at 10 shows neither.
- Skills are no longer filtered out of assignments after two 10s.
- My Skill Confidence page: two sections with the new titles, no Reactivate control, and the chart has no mastered or reactivated markers.
- Flag off: no change to what students and instructors see.
