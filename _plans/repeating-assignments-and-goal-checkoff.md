# Repeating assignments + "I met my goal" check-off

**Branch:** `claude/feat/repeating-assignments-goal-checkoff` (branched from `claude/feat/gradebook-excused-marker`, so the gradebook shows excused weeks as a blue **EX**)
**Status:** built, not deployed. Needs the migration before any page that uses it will load.

## Why
The ITP typing test is a weekly assignment that is the same every week. Many other assignments are too. Today each week's copy is made by hand. Students who reach their typing goal should also stop getting the test.

## What it does

### 1. One-time or repeating, asked when you create an assignment
- **+ Create → Assignment** now asks **How often?** first: **One-time** (the default) or **Repeats weekly**.
- Repeats weekly shows a list of the course's other weeks, with **All later weeks** / **All weeks** shortcuts.
- On create, the assignment is made in the chosen week, and a copy goes into each picked week:
  - on the same day name (the day is created if that week doesn't have it)
  - with the due date moved by the gap in week numbers, at the same Pacific time across DST changes
- It then opens straight in Edit. The other weeks start as blank copies until you push your content to them (see below).
- Course Outline only. Career Dev and Level Up don't get the choice.

### 2. Each copy is its own assignment, linked by `series_id`
- Every week keeps its own due date, submissions, extensions and gradebook column. Missing, late and readiness work the same as they do now.
- A **Repeats weekly** card on the instructor assignment page lists every week with its due date and Draft/Published state. It also has:
  - **+ Add to more weeks** (or **Make this repeat…** on a one-time assignment): turns any existing assignment into a repeating one.
  - After you **Save** an edit, a banner asks where the changes go: **This week only** or **This week and following weeks**. Following weeks get the title, instructions, how to turn in, settings, checklist and goal checkbox. Earlier weeks are never changed, due dates and published state are never changed, and any week where someone has already turned something in is skipped.
  - **Copy this week's content to the following weeks** does the same thing at any time.
  - Weeks are published one by one, as before.
  - **Stop this week repeating**: unlinks one week, which stays as a regular assignment.
- Checklist items are matched by position, so a student's own checks on unchanged items are kept.
- Duplicating a course gives its series new ids, so the copy's weeks never link back to the original course.

### 3. "I met my goal" checkbox
- Turned on per assignment in the **"I met my goal" checkbox** card, with your own wording (default *"I met my goal this week"*). **Apply to all N weeks** sets it on every week at once.
- Students see it as its own **Your goal** card under the regular checklist and submission. Checking it:
  - drops confetti (skipped when the device asks for reduced motion)
  - says *"Your instructor will see this when they grade and confirm it."*
  - can be unchecked until it's confirmed
- **Grader:** checking the box puts the assignment back in the to-grade queue, with no bell and no Slack message:
  - Already-graded work flips to "submitted" and keeps its grade.
  - A check-off-only assignment gets the usual placeholder submission.
  - Work that hasn't been turned in yet joins the queue when it's turned in.
  - Opening it shows a 🎯 banner, *"Ada checked that they met their goal. Please confirm it."*, with **Confirm & excuse later weeks**. Confirming takes already-graded work back out of the queue.
  - The submissions list shows a 🎯 *Says goal met* / *Goal met* pill.

### 4. Confirming excuses the later weeks
- Confirming sets `assignment_overrides.excused = true` for that student on every **later** week of the series, by course outline order. It uses the excusal that already exists, so the gradebook shows EX and missing/late/readiness skip those weeks with no new logic.
- If you add more weeks later, students already confirmed are excused from the new ones too.
- **Undo confirmation** removes only the excusals the confirmation made. An excusal or extension someone set by hand is left alone.

## Data model (`supabase/migrations/20261105000000_assignment_series_and_goal_checkoff.sql`)
- `assignments.series_id uuid`: links the weekly copies (no FK; a series is just its members)
- `assignments.goal_checkoff_label text`: null means no goal checkbox
- `assignment_goal_claims (assignment_id, student_id, claimed_at, confirmed_at, confirmed_by, excused_assignment_ids)`: unique per assignment+student. RLS lets students read only their own rows; all writes go through server actions.

## Code
- `src/lib/assignment-series.ts`: pure rules (outline order, "later weeks", due-date shifting, label cleanup), tested in `tests/assignment-series.test.ts`
- `src/lib/assignment-series-actions.ts`: `getSeriesInfo`, `pushAssignmentToWeeks`, `updateUpcomingWeeks`, `leaveSeries`, `setGoalCheckoff`, `setGoalClaim` (student), `confirmGoalClaim` (staff/TA)
- UI:
  - `CreateButton` (the How often? step)
  - `AssignmentSeriesPanel` (instructor assignment page)
  - `GoalCheckoff` + `Confetti` (student)
  - `GoalClaimReview` (grader)
  - the pill in `SubmissionsList`

## How to try it
1. Paste the migration into the Supabase SQL editor for the project you test against. Until it runs, the student assignment page and the grader page fail to load, because they read the new columns.
2. In an ITP course: **+ Create → Assignment → Repeats weekly**, pick the weeks, then write the typing test and add its checklist. Save, then click **Update N weeks**.
3. In the **"I met my goal" checkbox** card, turn it on, word it ("I met my typing goal (35 WPM)"), keep **Apply to all weeks**, and save. Publish the weeks.
4. As a student (or impersonating one), check the box and watch the confetti.
5. As the grader, open that student's submission, then **Confirm & excuse later weeks**. Check the gradebook for EX on the later weeks, and the student's later typing tests for the Excused badge.
6. Try **Undo confirmation** and check that the EX goes away.

## Open questions / possible follow-ups
- **Different targets per student:** the goal is the student's own (e.g. their WPM target). Nothing records the number itself.
- Not shown in the CourseEditor outline yet: a small ↻ badge on repeating assignments would help.
