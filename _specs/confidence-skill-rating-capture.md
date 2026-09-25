# Spec for confidence-skill-rating-capture

branch: claude/feature/confidence-skill-rating-capture

figma-component (if used): N/A

## Summary
This is Phase 2 of the larger confidence-tracking initiative (confidence-tracker-v2; see [`_plans/confidence-tracker-v2-roadmap.md`](../_plans/confidence-tracker-v2-roadmap.md)). Phase 1 (merged via [PR #151](https://github.com/AnnieCannons/ac-lms/pull/151)) let instructors tag assignments with a canonical, shared list of "Confidence Skills." This phase introduces the first student-facing behavior: when a student submits an assignment that has one or more tagged Confidence Skills, and this is that student's first-ever submission of that assignment, they're shown a simple, optional 1–10 rating prompt for each tagged skill as part of the submission form, before the Submit button. Ratings are stored in a new table, fully separate from the legacy `confidence_skills`/`confidence_entries` tables (the original, per-student free-text Confidence Tracker) and from the unrelated `assignments.skill_tags` ("Level Up Your Skills") feature — both remain untouched. This phase captures a plain rating only; goal-setting, target dates, study plans, trend visualization, and kudos/celebration logic are explicitly out of scope and arrive in later roadmap phases.

## Functional Requirements
- When a student opens an assignment's submission form and that assignment has at least one tagged Confidence Skill, and the student has never yet completed a first submission for that assignment, the form shows a rating prompt for each tagged skill, positioned before (above) the Submit button.
- Every skill's rating is optional — there is no explicit "skip" action or control. A student can leave any or all ratings blank, rate only some of the tagged skills, or rate all of them, and submit normally regardless.
- Ratings use a 1–10 scale, consistent with the legacy Confidence Tracker's `confidence_entries.score` scale (this remains an otherwise fully separate system/table — see Summary).
- If an assignment has zero tagged Confidence Skills, no rating UI appears at all — the submission form behaves exactly as it does today.
- The rating prompt is visible throughout the draft/edit flow (including across an unsubmitted Draft save), but a rating is only written to the database once the student completes the actual Submit action — saving a Draft never persists ratings.
- If a student enters one or more ratings but navigates away from the page before submitting (without closing the browser tab/window), those entered-but-unsaved ratings are still present if they return to the page in that same tab/window.
- The rating prompt appears only up through a student's first submission of the assignment. Once a student has completed a first submission (regardless of whether they rated all, some, or none of the tagged skills), the prompt never appears again for that student/assignment pair — including on a later resubmission (e.g. after the instructor marks it "Needs Revision").
- A rating a student gives is saved per student, per skill, per assignment — a rating captured here does not affect and is not affected by ratings the same student may separately give the same skill via a different assignment.
- Leaving ratings blank never blocks or delays the assignment submission — submission proceeds normally whether every skill is rated, none are, or some are.
- The rating prompt is visible in Student Preview mode and to an Observer viewing a student's submission, showing the same accurate ratings/state the actual student would see (so instructors/staff using these views see the full, real page) — but neither Student Preview nor Observer mode can submit the form (consistent with the existing restriction on those views today), so no rating data is ever created or changed from either view.
- If the assignment submission itself succeeds but saving one or more ratings fails (e.g. a network error), the student sees a clear message indicating that their assignment was submitted successfully, but that their confidence rating(s) could not be saved due to an error — making clear this wasn't something they did wrong.
- This phase does not introduce any goal, target date, study plan, trend page, kudos, or celebration behavior — a rating is simply captured and stored, with no follow-up UI in this phase.
- This phase does not modify, read from, or otherwise interact with the existing `confidence_skills`/`confidence_entries` tables or their UI (`/student/confidence`, `/instructor/courses/[id]/confidence`), nor with the unrelated `assignments.skill_tags`/`modules.skill_tags` ("Level Up Your Skills") feature.

## Figma Design Reference (only if referenced)
- Not applicable — no Figma file was provided. Visual style should match the existing `SubmissionForm` design system (card styling, spacing, button treatment already used for the checklist section and Submit/Save draft buttons).

## Possible Edge Cases
- A student had already submitted the assignment for the first time before this feature shipped (i.e. their "first submission" happened in the past, before any Confidence Skills existed or before this UI existed). A later resubmission by that student should not retroactively trigger the rating prompt, consistent with "a resubmission does not re-show the prompt" — but this means that student's confidence on this assignment's skills is simply never captured, which is expected/acceptable for this phase.
- An instructor adds a new Confidence Skill tag to an assignment after a student has already made their first submission. That newly added skill is never shown to that student for rating on this assignment (the trigger point has already passed).
- A student enters ratings, navigates to a different page in the app (not just scrolling), and comes back to the same assignment in the same browser tab/window before ever submitting — their previously entered ratings should still be there. Closing the tab/window, however, is allowed to lose them.
- A student submits with some skills rated and others left blank — only the rated skills should produce a stored record; skills left blank should not produce a placeholder/null record.
- Very many tagged skills on one assignment (edge case carried over from Phase 1, which allows unlimited tags) should not visually break the submission form layout.
- An instructor or staff member views a student's submission in Student Preview or Observer mode before that student has ever submitted — they should still see the full rating UI (empty, since nothing's been rated yet), just with no way to interact/submit it into existence.

## Acceptance Criteria
- [ ] Submitting an assignment with zero tagged Confidence Skills shows no rating UI and behaves identically to today's submission flow.
- [ ] Submitting an assignment with one or more tagged Confidence Skills, for the first time, shows a rating prompt for each tagged skill, positioned before the Submit button.
- [ ] Rating inputs use a 1–10 scale.
- [ ] Each skill's rating can be given or left blank independently of the others, with no explicit "skip" control needed.
- [ ] Leaving some or all skill ratings blank does not prevent or delay the assignment submission.
- [ ] A rating is not written to the database on a Draft save — only on an actual Submit.
- [ ] Ratings entered but not yet submitted remain on the page after navigating away and back within the same browser tab/window.
- [ ] A rating given is correctly associated with the specific student, skill, and assignment.
- [ ] After a student's first submission of an assignment, the rating prompt does not appear again for that assignment — including after the instructor marks it "Needs Revision" and the student resubmits.
- [ ] Student Preview mode and Observer mode both display the rating prompt with the same real data/state the student would see, but neither can submit the form, so no rating data is ever created or changed from those views.
- [ ] If the assignment submission succeeds but a rating fails to save, the student sees a clear, non-blaming error specific to the rating, while their submission's success is still clearly communicated.
- [ ] No changes in behavior, data, or UI are observable in the existing Confidence Tracker (`/student/confidence`, `/instructor/courses/[id]/confidence`) or in the "Level Up Your Skills" feature as a result of this work.
- [ ] No goal, target date, study plan, trend page, or kudos/celebration UI appears as part of this phase.

## Open Questions
<!--
When a question here gets answered (e.g. via an inline PR/file comment), do not delete or replace the question text.
Keep the original question and add the answer beneath it, like:
- <original question>
  - **Answer:** <answer>
This preserves a visible record of what was asked and decided, for anyone reading the spec later.
-->
- What rating scale should be used (e.g. 1–5, 1–10)? The legacy `confidence_entries` table uses a 1–10 self-rating scale, but this is a deliberately separate system, so it isn't required to match.
  - **Answer:** use the same 1–10 rating scale.
- Should the rating prompt also be visible/capturable when a student saves a Draft, or only when they perform the actual Submit? (Assumed in this spec: shown during the whole edit/draft flow, but only saved on actual Submit — flagging since the roadmap doesn't explicitly say.)
  - **Answer:** confirmed as assumed — visible during the draft flow, but only captured/saved as data after the actual Submit.
- If saving a rating fails (e.g. network error) but the underlying assignment submission itself succeeds, should the student see an error about the rating specifically, or should it fail silently so as not to block/confuse them about their (successful) submission?
  - **Answer:** show an error, but make clear the confidence rating didn't save due to an error (not the student's fault) while confirming the assignment itself was successfully submitted.
- Is there any instructor/staff-facing visibility into these Phase 2 ratings (e.g. on a gradebook or roster view), or is all visibility deferred to the Phase 4 student-facing trend page?
  - **Answer:** instructors/staff will get their own trend page (in addition to the student-facing one) to see each student's ratings as well as overall class ratings. Note for a later phase: we may also want to surface an assignment's ratings directly on the grading page when an instructor opens that assignment to grade it — not decided yet, just a idea to revisit.

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- An assignment with no tagged Confidence Skills renders the submission form with no rating UI.
- An assignment with tagged Confidence Skills renders a 1–10 rating prompt for each tagged skill, positioned before the Submit button, on a student's first visit to the form.
- Rating one skill and leaving another blank, then submitting, saves only the rated skill and does not save a record for the one left blank.
- Submitting with no ratings entered at all still successfully saves the assignment submission.
- Saving a Draft with ratings entered does not persist any rating to the database; submitting afterward does.
- After a first submission, reopening the form (e.g. after "Needs Revision") does not show the rating prompt again.
- Student Preview mode and Observer mode render the rating prompt with real data, but attempting to submit from either view does not create or change any rating data.
- When the assignment submission succeeds but a rating save fails, the student sees an error scoped to the rating, distinct from and not implying failure of the submission itself.
