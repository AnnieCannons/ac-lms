# Repeating assignments + "I met my goal" check-off

**Branch:** `claude/feat/repeating-assignments-goal-checkoff` (branched from `claude/feat/gradebook-excused-marker`, so the gradebook shows excused weeks as a blue **EX**)
**Status:** built, not deployed. Needs the migration before any page that uses it will load.

## Why
The ITP typing test is a weekly assignment that is the same every week. Many other assignments are too. Today each week's copy is made by hand. Students who reach their typing goal should also stop getting the test.

## What it does

### 0. Due dates (every assignment made from + Create)
- You pick the week (module) and day, and the **Due date** fills in the day after that day, using the course start date and the module's week number.
- It moves forward past weekends, holidays (`calendar_holidays`) and breaks (`calendar_breaks`): a Thursday is due Friday, and a Friday is due Monday.
- A note says when it was moved past a holiday, or when the class day itself is a holiday. You can still change the date.
- If the week can't be placed on the calendar (no start date, no week number, or a day that isn't a weekday name), the field is left blank for you to fill in.

### Missing and scoring are unchanged
- Each week is a normal assignment, so it's missing once past due with nothing turned in. An "incomplete" grade still counts toward the readiness score. Only a confirmed goal excuses later weeks.
- Checking the goal box never creates a submission, so it doesn't stop work from counting as missing.

### 1. One-time or repeating, asked when you create an assignment
- **+ Create → Assignment** asks **How often?** first: **One-time** (the default) or **Repeats weekly**.
- **One-time:** Section → Module → Day → Due date, as before.
- **Repeats weekly** has no single module to pick. Instead you choose:
  - **Which day?** Monday to Friday.
  - **Which weeks?** The course's real week modules in week order. Every published week starts checked, and unpublished ones (e.g. a Lab/Career week) are listed unchecked.
- A "real week" is a module with a week number. If two share a number, the one titled "Week N" wins, so a stray "Extra?" saved as week 1 isn't listed.
- Each week shows its date and due date, plus a note when a holiday moved it or a break skipped it.
- On create:
  - the assignment is made in the first chosen week and copied to the rest, on the chosen day (the day is added to a week if it's missing)
  - a holiday on that day moves that week to the closest open day before it; a week that's a break all week is skipped
  - each is due the day after, past weekends, holidays and breaks; if a week can't be placed on the calendar, it falls back to the first week's due date moved by the week gap
  - every copy is still its own assignment, so you can drag any week to another day or change its due date afterwards. Pushing content to following weeks never changes a week's day or due date.
- It then opens straight in Edit. The other weeks start as blank copies until you push your content to them.
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
- It's in the **assignment editor**, under the Grading Checklist, and only shows for repeating assignments. It's off by default, so only the ones you choose (e.g. the typing test) get it.
- Tick **Students can check that they met their goal** and word it (default *"I met my goal this week"*). It saves with the assignment, and **This week and following weeks** carries it to the later weeks. The assignment page shows a 🎯 *Goal checkbox* badge when it's on.
- Students see it as its own **Your goal** card under the regular checklist and submission. Checking it:
  - drops confetti (skipped when the device asks for reduced motion)
  - says *"Your instructor will see this when they grade and confirm it."*
  - can be unchecked until it's confirmed
- **Grader:** checking the box puts the assignment back in the to-grade queue, with no bell and no Slack message:
  - Already-graded work flips to "submitted" and keeps its grade.
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
3. In the editor's **Goal Checkbox** section, turn it on and word it ("I met my typing goal (35 WPM)"). Save, then pick **This week and following weeks**. Publish the weeks.
4. As a student (or impersonating one), check the box and watch the confetti.
5. As the grader, open that student's submission, then **Confirm & excuse later weeks**. Check the gradebook for EX on the later weeks, and the student's later typing tests for the Excused badge.
6. Try **Undo confirmation** and check that the EX goes away.

## Open questions / possible follow-ups
- **Different targets per student:** the goal is the student's own (e.g. their WPM target). Nothing records the number itself.
- Not shown in the CourseEditor outline yet: a small ↻ badge on repeating assignments would help.
