# Spec for confidence-trend-pages

branch: claude/feature/confidence-trend-pages

figma-component (if used): N/A

## Summary
This is Phase 4 of the larger confidence-tracking initiative (confidence-tracker-v2; see [`_plans/confidence-tracker-v2-roadmap.md`](../_plans/confidence-tracker-v2-roadmap.md)). Phases 2 and 3 (merged via [PR #153](https://github.com/AnnieCannons/ac-lms/pull/153) and [PR #157](https://github.com/AnnieCannons/ac-lms/pull/157)) capture a student's 1–10 confidence rating per tagged skill on their first submission of an assignment, plus — for a skill's first rating, or any later occasion until a goal is captured — an optional goal, target date, and study plan. A skill rated 10 twice is "mastered" and stops appearing on assignments. Today all of that data is captured but nothing displays it back to anyone, and there is no way to bring a mastered skill back.

This phase adds the two read surfaces and the one remaining write control: (1) a new student-facing page showing that student's own ratings, goals, target dates, and study plans over time, per skill; (2) a new instructor/staff-facing page showing each student's ratings individually as well as overall class ratings; and (3) a "reactivate" control on the student page that lets a student bring a mastered skill back onto future assignments, resetting it so the next rating is treated like a brand-new skill again.

Both pages are new and sit alongside the pre-existing Confidence Tracker (`/student/confidence`, `/instructor/courses/[id]/confidence`, backed by `confidence_skills`/`confidence_entries`), which keeps working exactly as it does today, with one addition each: the old student page gets a link pointing to the new student page, and the old instructor confidence page gets a link pointing to the new instructor trend page. Neither the old tracker's data nor its pages are otherwise changed, and the unrelated "Level Up Your Skills" feature (`assignments.skill_tags`) is untouched. Retiring the old tracker is a deliberate follow-up, not part of this phase (see "Follow-up to remember" below). Both new pages sit behind the same `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` feature flag as Phases 2–3; the added links on the old pages are shown only when that flag is on.

This phase does not add kudos, "what helped" prompts, goal-met celebration, reminders, or personal pattern insights. Those are planned, not dropped — kudos on any rating increase is Phase 5, goal-met celebration and reminders are Phase 6, and pattern insights are Phase 7. They are deferred because this phase is a read-and-display surface, whereas each of those is triggered at submission time and depends on the "what helped" data that doesn't exist yet. The student page is deliberately the surface those later phases will extend.

**Follow-up to remember:** once the new trend pages are live and students have moved over, retire the old Confidence Tracker pages (`/student/confidence` and the old instructor confidence page). Retiring them must not delete any data students saved in the old tracker; the `confidence_skills`/`confidence_entries` history needs an explicit decision (archive, export, or read-only view) at that time.

## Functional Requirements

### Student trend page
- A new student-facing page, distinct from the existing `/student/confidence` page, showing the logged-in student's own data from this feature only. It is reachable from the student navigation, labeled so it cannot be confused with the older Confidence Tracker, and the older student Confidence Tracker page links to it (the only change made to the old page).
- The page is organized per skill: every skill the student has rated at least once appears, regardless of which course or assignment the rating came from — all courses together on one page, not scoped per course. Skills the student has never rated do not appear.
- For each skill, the student sees their ratings in chronological order — each with its 1–10 value, the date it was recorded, and the assignment it was given on — presented both as a simple visual trend (so movement up or down is visible at a glance) and as an underlying dated list.
- Because a skill's ratings can span several courses, the visual trend shows a clear breakpoint marker at the point where a new course's ratings begin, labeled with that course's name, so the student can see how their confidence carried over from one course into the next. The dated list also labels each rating with its course. A skill rated in only one course shows no breakpoint.
- The visual trend also marks the moments a skill was mastered and, if applicable, reactivated (see Reactivate control), so those milestones are visible in context alongside the ratings.
- For each skill that has a captured goal, the student sees the current goal, its target date, and the study plan they chose (including any "Other" free text), alongside their most recent rating for that skill so progress toward the goal is visible. Wording is neutral and descriptive — no celebration, kudos, or "goal met" treatment (that is Phase 6), and a target date that has passed is shown plainly, without shaming or "overdue" language.
- Goals are kept as a history, never overwritten: if a skill has had more than one goal over time (in this phase, only via reactivation), the current goal is shown prominently and earlier goals remain viewable beneath it with the date each was set, alongside the ratings recorded during that period. Replacing a goal never removes progress already made.
- A skill whose goal was captured as "maintaining this rating" (rated 10 when first rated) is shown as maintaining, with no target date or study plan.
- A skill with no captured goal simply shows its ratings with no goal block.
- Mastered skills (rated 10 at least twice) are shown in their own clearly labeled section, still with their full rating history and the date they were mastered, and each carries a "Reactivate" control.
- A skill that has been mastered and later reactivated is shown in the regular list with a clear indicator that it was previously mastered (including when it was mastered and when it was reactivated), so the student's earlier achievement remains visible and is never erased.
- Skills that are not mastered show no reactivate control.
- The page has a friendly empty state for a student who hasn't rated anything yet, explaining that ratings appear here after they submit an assignment with tagged skills.
- A student only ever sees their own data; there is no way to view another student's page.

### Reactivate control
- Reactivating a mastered skill makes it eligible to appear again on any assignment where it is tagged, for that student only, from that point forward.
- After reactivation, the student is simply asked to rate the skill again on future assignments: they choose their current level and set a new goal, exactly as when a skill is new (goal-setting is offered, and the maintaining-at-10 path applies again if they rate it 10). The "New" badge is reserved for a skill the student has never rated before, so a reactivated skill does not show it. (Changed after Phase 6 review; this line originally said the "New" tag shows.) Counting toward mastery starts over, so two further 10-ratings are required before it is mastered again.
- Reactivation never deletes, replaces, or edits anything from before it: past ratings, the earlier goal and its target date and study plan, and the fact and date of the earlier mastery all remain. New ratings and the new goal are recorded as a continuation of the same skill's history, distinct from the earlier stretch, rather than overwriting it.
- The system records each mastery and each reactivation as its own dated event, so a skill that is mastered, reactivated, and mastered again shows every cycle rather than only the latest.
- Because reactivation restarts goal capture, the earlier goal stops being the current goal for future ratings, but it stays viewable as history on the page (see the goal history requirement above), including for instructors.
- Reactivation asks for a lightweight confirmation before taking effect, explaining in plain language that the skill will show up on future assignments again and that their earlier history is kept.
- The action is available only to the student it belongs to, is verified server-side (not merely hidden in the UI), and can only be applied to a skill that is currently mastered — attempting it on a non-mastered skill has no effect. Repeating it (e.g. a double click) is harmless.
- Reactivation is unavailable in Student Preview and Observer mode: those views may show the control in its accurate state but it cannot be used, so no student data is ever changed from them.
- If reactivation fails, the student sees a clear, non-blaming error and the skill remains mastered.
- Once reactivated, the skill moves out of the mastered section back into the regular list, and its "pending new" state is reflected on the page in a way that makes clear it will be treated as new next time (for example, a short note that it will come back on their next tagged assignment).

### Instructor/staff trend page
- A new instructor/staff-facing page, scoped to a course, showing confidence ratings for the students currently enrolled in that course. It is separate from the existing per-course `confidence` page for the old tracker, which is left as it is apart from a link to the new page (for the same staff roles that can see the new page; the link is shown only when the flag is on).
- Access matches Phases 1–3: admin, instructor, and staff only. TAs are excluded (confirmed), consistent with the existing access and data-visibility rules for this feature. Access is verified server-side on every request; because the view reads across students, it must not rely on the student-facing data rules alone.
- Only currently active students in the course are included, matching how the gradebook builds its roster; students who have since left the course are not shown.
- Class overview: the overview is scoped to the current course — it covers only the skills tagged on this course's assignments, only this course's active students, and only ratings given on this course's assignments. For each such skill that students have rated, it shows where the class is now, using each student's most recent rating for that skill: the average, the median, and the distribution of ratings, together with a plain count of how many students rated it (for example, "6 students rated"). The count is shown for every skill, with no minimum threshold or warning. This lets an instructor spot skills the class is struggling with.
- Per-student view: a roster of the course's active students, each expandable or linkable into that student's individual ratings, showing per skill their rating history over time (value, date, assignment), their latest rating, and their goal history (current goal plus earlier goals) with target date/study plan where captured. It is the same information the student sees on their own page, minus any control.
- Earlier-course context: within a student's view, for each skill that is tagged on this course, the instructor can also see how that same student rated that same skill in their other courses. Those earlier ratings appear on the same trend, in read-only form, with a breakpoint marker and course name at the point each course begins, exactly as on the student's own page. Instructors may see this earlier-course context even for courses they don't teach (confirmed), since staff access to this feature's data is global. It is limited to skills tagged on the current course (an instructor is not shown the student's unrelated skills from other courses), and it is never included in the class overview figures, which stay scoped to this course.
- The instructor can also see which skills a student has mastered, when, and which they have reactivated and when, but cannot reactivate on a student's behalf (confirmed: reactivation is a student-only action).
- Active students in the course with no ratings yet are listed as having no data, not omitted, so an instructor can tell "hasn't rated" apart from "not shown."
- The page can be narrowed to a single skill and to a single student, and defaults to showing the whole class.
- Wording stays descriptive and supportive of instructors' use (spotting who might need help), not evaluative of students; consistent with the app's non-prescriptive tone elsewhere.
- The page is read-only.

### Cross-cutting
- Both pages, their navigation links, and the links added to the old tracker pages are gated behind `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED`. With the flag off, neither page is reachable or linked, the old pages show no new link (so they look exactly as they do today), and the reactivate action does nothing. Phase 1's instructor tagging remains ungated, as before.
- Ratings, goals, target dates, and study plans shown on these pages come only from this feature's data (ratings and skill progress) — nothing is read from or written to the old `confidence_skills`/`confidence_entries` tables or the `skill_tags` fields.
- When an instructor renames a skill (a global rename per Phase 1), both pages show the new name everywhere, including for old ratings.
- The pages are usable on mobile widths, accessible by keyboard and screen reader (the trend visual must have a non-visual equivalent, which the dated list provides), and respect the app's existing light/dark and high-contrast theming.
- Study plan options are displayed with the same wording used when the student chose them.

## Figma Design Reference (only if referenced)
- Not applicable — no Figma file was provided. Pages should follow the existing student and instructor page styling, card treatment, and theming already used across the app, including the rating scale's visual language from the submission form.

## Possible Edge Cases
- A student has rated a skill on assignments across multiple courses — the student page shows all of it under one skill with a breakpoint marker where each new course's ratings begin. On the instructor page for a given course, the class overview counts only that course's active students and ratings given on that course's assignments; a student's drill-in additionally shows that same student's earlier ratings of the same skill from their other courses as read-only context, clearly labeled by course and never counted in the class figures.
- A student is enrolled in two courses at the same time and rates the same skill in both — ratings stay in true date order, and the course breakpoint marks each change of course between consecutive ratings, so alternating courses produce several breakpoints without confusing the trend.
- A student has been mastered on a skill in an earlier course and the instructor of a later course has the same skill tagged — the instructor's drill-in shows the earlier mastery in context; since that student's mastered skill isn't offered again unless reactivated, they may show no new ratings in the current course, which is displayed as such rather than as missing data.
- A skill goes through more than one mastered-then-reactivated cycle — every mastery and reactivation is shown with its date, and every earlier goal remains in the goal history.
- A student's only rating of a skill is a 10 (count of 1, not mastered) — it appears in the regular list, maintaining, with no reactivate control.
- A student rates a skill 10 twice, becomes mastered, reactivates, and rates it 10 once more — it is not yet mastered again and appears in the regular list; a second 10 after reactivation is needed.
- A student reactivates a skill while a currently-open assignment is tagged with it — it is offered on that assignment only if the student hasn't already submitted it (the rating prompt still applies only to a first submission).
- A mastered skill that an instructor later untags from all assignments is still shown in the student's mastered section with its history, and can still be reactivated; it simply won't appear anywhere until tagged again.
- A skill is renamed by an instructor after ratings exist — both pages reflect the new name for all history.
- An assignment that a rating was given on is later soft-deleted, or renamed — ratings remain visible; the deleted assignment is shown in a neutral way (e.g. a generic label) rather than causing an error or dropping the rating.
- A skill is deleted from the shared taxonomy — its ratings and progress cascade away with it; neither page should error, and the skill simply no longer appears.
- A student's target date is in the past — shown plainly as a past date, with no penalizing language, and the goal stays in place (this phase never changes or closes a goal on its own).
- A goal's rating comparison: a student's latest rating is below, at, or above their goal — the page shows the two side by side neutrally in all cases. Celebration, kudos, and any prompt to set a next goal are deliberately left to Phases 5–6, so nothing is triggered here even when a goal has been met.
- A student who hits reactivate twice quickly, or in two tabs — the second attempt is a harmless no-op.
- A student opens the reactivate confirmation, and in the meantime the flag is turned off — the action is rejected and the student sees a clear message rather than a silent failure.
- Instructor views a course with many students and many skills — the page remains usable (roster and overview do not become unreadable or unusably slow).
- Instructor previewing the course as a student sees the student page for their own account (typically empty) with the reactivate control unusable — no data is changed.
- An observer views the student page — sees accurate state for the account being viewed with no way to reactivate.
- A student who has left the course or is no longer an active student — not shown on the instructor page and not counted in the class overview, matching the gradebook. Their own student page is unaffected.
- Class overview for a skill rated by only one student — shown with its count ("1 student rated") and its average, median, and distribution, with no additional warning.
- A student whose only ratings came before Phase 3's backfill (progress rows created from existing ratings with no goal captured) — shown as ratings with no goal block, without errors.

## Acceptance Criteria
- [ ] A new student-facing trend page exists, is separate from `/student/confidence`, is linked from student navigation, and shows only the logged-in student's own data.
- [ ] The old `/student/confidence` page links to the new student page, and the old per-course instructor confidence page links to the new instructor trend page (each only when the feature flag is on); both are otherwise unchanged.
- [ ] Every skill the student has rated appears, across all of their courses, with its ratings in chronological order, including value, date, course, and assignment, as both a visual trend and a dated list.
- [ ] The visual trend shows a labeled breakpoint marker wherever a new course's ratings begin, and marks when a skill was mastered and reactivated.
- [ ] Skills with a captured goal show the current goal, target date, chosen study plan (with any "Other" text), and the most recent rating alongside it; earlier goals remain viewable as history with the date each was set; "maintaining" skills show as maintaining with no date or plan; skills with no goal show no goal block.
- [ ] No celebration, kudos, "goal met," "overdue," or set-a-next-goal prompt appears anywhere in this phase.
- [ ] Mastered skills appear in their own labeled section with full history, the date they were mastered, and a Reactivate control; non-mastered skills show no such control.
- [ ] Reactivating a mastered skill (after confirmation) makes it eligible on future assignments, starts the 10-rating count over, marks it as pending-new, records when it was reactivated, and returns it to the regular list, while preserving all past ratings, its earlier goal(s), and the record of its earlier mastery.
- [ ] A reactivated skill shows a clear indicator that it was previously mastered, with the mastery and reactivation dates; a skill that goes through multiple cycles shows every one.
- [ ] After reactivation, the skill is offered again on that student's assignments where it is tagged, shows no "New" badge (it has earlier ratings), lets the student choose their current level and set a new goal, and requires two further 10-ratings to be mastered again.
- [ ] The new goal captured after reactivation is recorded alongside, not in place of, the earlier goal.
- [ ] Reactivation is verified server-side, only allowed for the owning student on a currently-mastered skill, and repeating it is harmless.
- [ ] Reactivation cannot be performed from Student Preview or Observer mode, and no data changes from those views.
- [ ] A failed reactivation shows a clear, non-blaming error and leaves the skill mastered.
- [ ] A friendly empty state appears for a student with no ratings.
- [ ] A new instructor/staff-facing page exists per course, separate from the old tracker's course confidence page, showing a class overview per skill and a per-student breakdown of individual ratings, goal history, target dates, and study plans.
- [ ] The class overview shows, for every skill tagged on the course that students have rated, the average, median, and distribution of each student's most recent rating, plus a count of students who rated it (e.g. "6 students rated"), with no minimum threshold or warning.
- [ ] The instructor page is restricted server-side to admin, instructor, and staff; TAs and students cannot reach it or its data.
- [ ] The instructor page lists only currently active students in that course (matching the gradebook), and class overview figures use only those students' ratings given on that course's assignments.
- [ ] Within a student's drill-in, ratings of the same tagged skill from that student's other courses appear as read-only context with course breakpoints, are limited to skills tagged on the current course, and are never counted in the class overview.
- [ ] Active students with no ratings are listed as having no data rather than omitted; mastered and reactivated skills (with dates) are visible to instructors, who cannot reactivate on a student's behalf.
- [ ] The instructor page can be narrowed by skill and by student, and is read-only.
- [ ] Both pages and their navigation links are hidden and unreachable when `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` is off, and the reactivate action is rejected.
- [ ] Skill renames are reflected everywhere for historical data; soft-deleted assignments and deleted skills never cause errors.
- [ ] Both pages work at mobile widths, are keyboard and screen-reader accessible (with a non-visual equivalent of the trend visual), and respect light/dark and high-contrast themes.
- [ ] No changes in behavior or data are observable in the existing Confidence Tracker (their only change is the added link to the new page) or in the "Level Up Your Skills" feature, and no data saved in the old tracker is deleted or altered.
- [ ] No kudos, "what helped" prompts, reminders, notifications, or pattern insights appear as part of this phase.

## Open Questions
<!--
When a question here gets answered (e.g. via an inline PR/file comment), do not delete or replace the question text.
Keep the original question and add the answer beneath it, like:
- <original question>
  - **Answer:** <answer>
This preserves a visible record of what was asked and decided, for anyone reading the spec later.
-->
- When a skill is reactivated, its goal, target date, and study plan must stop applying so goal-setting is offered again — but should the earlier goal remain visible on the student and instructor pages as history (for example, "previous goal: 8 by March 3"), or is it fine for it to be replaced by the next goal captured? Keeping it likely means an additional place to store past goals, since the current progress record holds only one goal per student/skill. Recommendation: keep past goals visible as history only if it's cheap; otherwise accept overwrite in this phase and revisit alongside Phase 5/6, when "what helped" answers will want that history too.
  - **Answer:** past goals stay visible as history — nothing is overwritten. If a student's first goal was 4, a later goal replaces it as the *current* goal but the earlier goal and all the progress made under it stay on the page. Likewise, on reactivation the original mastery is never erased: the student can see when they first mastered the skill, when they reactivated it, and their new ratings and new goal as a continuation of the same skill's history, kept distinct from the earlier stretch. This means goals must be stored as a history rather than one overwritable record per student/skill (a change from Phase 3's single-record design, to be worked out in planning).
  - **Answer (scope, confirmed):** in this phase the only new goal a student can create is the one captured after reactivation. Setting a *new* goal after meeting the current one (and detecting that a goal has been met) is Phase 6's goal-met flow — Phase 4 builds the goal history so Phase 6 can append to it.
- Where should the student page live and what should it be called, so students don't confuse it with the older "Confidence Tracker" page they may already use (for example, "My Skill Confidence" under the student navigation)? Should the older page link to it, or should the two remain fully independent?
  - **Answer:** the older Confidence Tracker page should link to the new page. The two remain separate pages for now; the old one is untouched apart from that link, and retiring it is a follow-up (see "Follow-up to remember" in the Summary and the roadmap). The new page's exact name and navigation placement still need to be finalized during planning, keeping it clearly distinguishable from the old tracker.
- Should the student page show skills across all of the student's courses in one place (assumed here, since skills are shared and a student's progress on a skill is one record regardless of course), or be scoped per course?
  - **Answer:** all courses are shown together, with a visual breakpoint on the chart/graph marking where a new course started.
- For the instructor class overview, should "typical current rating" use each student's most recent rating per skill (assumed here — reflects where the class is now), or all ratings ever given? And should it show an average, a median, or just the distribution?
  - **Answer:** show where the class is now — each student's most recent rating per skill — as an average, a median, and a distribution.
- Should the instructor page show a minimum-data caution (for example, "only 2 students rated") for skills with very few ratings, and if so at what threshold?
  - **Answer:** no threshold or caution — show the number of students who rated for every skill (e.g. "x students rated").
- How should enrollment status be handled on the instructor roster — include only currently active students, or also students who have since left the course? Does the app already have a standard for this in other roster views (gradebook, readiness) that this should match?
  - **Answer:** include only currently active students, same as the gradebook does.
- Should TAs get read access to the instructor trend page for their own course? This spec assumes not, matching Phases 1–3 (TAs are excluded from tagging and from reading this data). Confirm or change.
  - **Answer:** confirmed — TAs do not get read access to the instructor trend page.
- The roadmap lists an idea to revisit: surfacing an assignment's confidence ratings directly on the grading page when an instructor opens an assignment to grade. Assumed out of scope for this phase — confirm, or pull it in now since the data will exist.
  - **Answer:** confirmed — out of scope for this phase.
- Should instructors be able to reactivate a mastered skill on a student's behalf (for example, after a student asks in person)? Assumed no — reactivation is a student-only action, since it's framed around the student's own sense of their confidence.
  - **Answer:** reactivation is a student-only action.
- Should the student page let a student export or print their history? Assumed out of scope.
  - **Answer:** out of scope.
- When an instructor views a student, is it acceptable for them to see that student's ratings of the same skill from courses the instructor does not teach? This spec proposes yes (read-only, limited to skills tagged on the current course, and never counted in the class overview), since instructor/staff/admin access to this feature's data is already global rather than per-course and RLS already lets them read all rows — but it is a privacy-relevant choice worth explicitly confirming. Alternative: limit earlier-course context to courses the instructor also has staff access to.
  - **Answer:** yes — it is acceptable for instructors to see that student's ratings of the same skill from courses the instructor does not teach (read-only, limited to skills tagged on the current course, never counted in the class overview).
- Should the old instructor confidence page (per course) also get a link to the new instructor trend page, mirroring the link added to the old student page? Only the old student page's link has been decided.
  - **Answer:** yes — the old instructor confidence page also links to the new instructor trend page.

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- The student page groups ratings by skill in chronological order, with the correct value, date, course, and assignment for each, and shows nothing for skills the student never rated.
- A skill rated in two courses shows a course breakpoint at the point the second course's ratings begin; a skill rated in one course shows none.
- A skill with a captured goal shows goal, target date, study plan (including "Other" text), and latest rating; a "maintaining" skill shows no date or plan; a skill with no goal shows no goal block.
- A target date in the past renders neutrally, with no celebration or overdue wording.
- Mastered skills appear in their own section with a Reactivate control; non-mastered skills (including one with a single 10-rating) do not.
- The empty state renders for a student with no ratings.
- Reactivating a mastered skill starts the 10-rating count over, clears current mastered state, marks it pending-new, and records the reactivation time, while leaving past ratings, the earlier goal, and the record of the earlier mastery untouched.
- A skill that is mastered, reactivated, and mastered again shows both mastery events and both reactivation/mastery dates; the goal captured after reactivation is stored alongside the earlier goal, and both appear in the goal history.
- A reactivated skill shows a "previously mastered" indicator with dates in the regular list.
- Reactivating a skill that is not currently mastered, or one belonging to a different student, is rejected and changes nothing; repeating a successful reactivation is a harmless no-op.
- After reactivation, the skill is included again in the tagged-skill list shown to that student, is marked new, and needs two further 10-ratings to be mastered again.
- The reactivate control is disabled or rejected in Student Preview and Observer mode, and calling the action from those modes changes nothing.
- A failed reactivation surfaces an error in the UI and leaves the skill in the mastered section.
- The instructor page's access check admits admin, instructor, and staff, and rejects TAs, students, and unauthenticated users.
- Class overview figures (students-rated count, average, median, distribution) are computed correctly from a small fixed data set, using each student's most recent rating per skill, including a skill rated by only one student.
- The class overview excludes students who are no longer active in the course, and excludes ratings given on other courses' assignments.
- A student's drill-in shows that student's ratings of the same skill from other courses as read-only context, only for skills tagged on the current course, and those ratings never affect the class overview figures.
- Students with no ratings appear as "no data" in the instructor roster.
- The instructor page offers no reactivate control, and filtering by skill or student narrows the view correctly.
- With `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` off, both pages are unreachable and the reactivate action is rejected.
- A renamed skill and a soft-deleted assignment both render without error.
- The old `/student/confidence` page and the old per-course instructor confidence page each show a link to their new counterpart when the flag is on, show no new link when it is off, and their existing behavior is otherwise unchanged.
- An instructor's drill-in shows a student's earlier-course ratings even for courses that instructor does not teach.
