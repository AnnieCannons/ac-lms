# Spec for confidence-new-skill-goal

branch: claude/feature/confidence-new-skill-goal

figma-component (if used): N/A

## Summary
This is Phase 3 of the larger confidence-tracking initiative (confidence-tracker-v2; see [`_plans/confidence-tracker-v2-roadmap.md`](../_plans/confidence-tracker-v2-roadmap.md)). Phase 2 (merged via [PR #153](https://github.com/AnnieCannons/ac-lms/pull/153)) added a plain, optional 1–10 confidence rating per tagged skill to the submission form, captured once on a student's first-ever submission of an assignment. This phase adds no new trigger point — it extends that same rating capture with per-skill "new vs. existing" detection: a skill the student is rating for the very first time is visually marked with a "New" tag, and once rated, can optionally also capture a goal (an editable target rating, auto-suggested at current rating + 2), which in turn requires a target date (editable, auto-suggested one week out) and a study-plan selection from a fixed list. A skill the student has rated before (via this assignment or any other) continues to show only the plain rating, exactly as in Phase 2. This phase does not add trend visualization, kudos, or celebration logic — those remain later roadmap phases.

## Functional Requirements
- "New" vs. "existing" is evaluated per student, per skill — independent of which assignment the skill is tagged on. A skill is "new" for a student if no `confidence_tracker_ratings` row exists yet for that student/skill combination (across any assignment); it is "existing" the moment one such row exists, from that point forward, everywhere that skill appears again.
- This phase does not change when the overall rating prompt appears — it still shows only on a student's first-ever submission of an assignment that has at least one tagged Confidence Skill, per Phase 2's existing trigger.
- Any tagged skill detected as "new" for that student displays a "New" tag/badge next to its name in the rating card, visible as soon as the prompt renders — regardless of whether the student goes on to enter a rating — so the student can tell at a glance which skills they've never rated before.
- Once the student selects a 1–10 rating for a skill detected as "new," that skill's card expands inline (beneath the rating control) to reveal an optional goal-setting section:
  - **Goal**: an editable 1–10 target rating, pre-filled with the student's just-entered rating + 2. Setting a goal is optional — the student can clear it to leave the skill without a goal (equivalent to skipping goal-setting entirely). If kept or edited, the goal must be at least the current rating + 1 (never equal to or below the current rating) and no higher than 10, the top of the scale.
  - **Target date**: an editable date, pre-filled to one week from today. Required whenever a goal is set; must be a future date (strictly after today), and no later than two weeks (14 days) from today.
  - **Study plan**: a single-select from a fixed list, required whenever a goal is set, with an "Other" option that reveals a free-text field:
    1. Practice on my own (exercises, coding challenges, repetition)
    2. Review the lesson materials again
    3. Get help from a TA or instructor
    4. Watch outside tutorials or videos
    5. Study flashcards
    6. Review class notes
    7. Other (write-in)
- If a student clears the goal after entering one, the target date and study plan are no longer required and are not saved — only the plain rating is saved for that skill, same as if no goal had ever been set.
- If a student clears/deselects their rating for a skill after the expanded fields have appeared, the expanded fields collapse again and any values entered into them (goal, target date, study plan) are discarded (not saved).
- A skill detected as "existing" (already rated at least once before, on this assignment or any other) never shows the "New" tag or the expanded fields — it behaves exactly as in Phase 2, a plain optional 1–10 rating with no goal/date/plan capture, regardless of whether that skill happens to be tagged on multiple assignments.
- The goal, target date, and study plan for a newly-rated skill are only written to the database on actual Submit, never on a Draft save — consistent with how the Phase 2 rating itself is handled. Entered-but-unsubmitted values (rating, goal, target date, study plan, and any "Other" free text) persist via the same `sessionStorage` mechanism Phase 2 uses, across in-app navigation within the same browser tab/window, and are lost if the tab is closed.
- Leaving the goal at its auto-suggested default (without editing it) still saves that value on Submit, along with whatever target date and study plan are present at that point. A rating on a new skill can still be left blank entirely (in which case the "New" tag still showed, but nothing is saved for that skill), consistent with Phase 2's "every rating is optional."
- If a new skill's very first-ever rating is already 10 (the top of the scale), no numeric goal is offered (since a valid goal must be at least current + 1, which would exceed the scale). Instead, the goal section shows messaging to the effect of "maintaining this rating" in place of a numeric goal input — this still counts as "a goal is set" for the purposes of the rule above, so a target date and study plan are still requested (describing how the student plans to maintain, rather than raise, their rating).
- Independent of whether a goal was ever set, the system keeps a running count, per student/skill, of how many times that skill's rating has been recorded as exactly 10 — across every assignment it's tagged on, whether that particular rating was the skill's first-ever ("new") one or a later plain ("existing") one.
- Once a skill's count of 10-ratings reaches 2 for a given student, that skill is considered **mastered**: it is no longer offered for rating on any assignment submitted afterward for that student, even if an instructor keeps it tagged (on that assignment or on new ones) — and no further goal-setting is available for it.
- A mastered skill can only be brought back via a "reactivate" control on the student's trend page — a Phase 4 surface, out of scope to build in this phase since that page doesn't exist yet. Reactivating resets the skill's 10-rating count to zero and makes it eligible to appear again on any assignment where it's tagged; the next time the student rates it, it is treated exactly like a brand-new skill again (shows the "New" tag, offers goal-setting, including the maintaining-at-max path if rated 10 again). Until Phase 4 ships that control, a mastered skill has no way to be brought back — an accepted temporary limitation consistent with this feature's phased rollout.
- The expanded capture is gated behind the same `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` feature flag Phase 2 already uses — no separate flag for this phase.
- Visible in Student Preview and Observer mode with the same accurate new/existing state and pre-filled suggestions a real student would see, but — consistent with Phase 2 — neither view can ever submit the form, so no goal/date/plan data is ever created or changed from those views.
- If the assignment submission succeeds but saving a new skill's expanded data (goal/target date/study plan) fails, the student sees a non-blocking error scoped to that failure, following the same pattern as a Phase 2 rating-save failure — distinct from and not implying failure of the submission itself.
- This phase does not modify, read from, or otherwise interact with the existing `confidence_skills`/`confidence_entries` tables, their UI (`/student/confidence`, `/instructor/courses/[id]/confidence`), or the unrelated `assignments.skill_tags`/`modules.skill_tags` ("Level Up Your Skills") feature.
- This phase does not introduce any trend page, kudos, or celebration UI — a goal, target date, and study plan are simply captured and stored, with no follow-up UI in this phase (arrives in Phase 4 onward).

## Figma Design Reference (only if referenced)
- Not applicable — no Figma file was provided. The expanded new-skill fields should visually read as part of the same per-skill card introduced in Phase 2 (same card styling, spacing, and button treatment), expanding inline rather than opening a modal or a separate section.

## Possible Edge Cases
- A student rates the same skill as "new" on Assignment A, then opens Assignment B (tagged with the same skill) for the first time before ever meeting or revisiting the goal from Assignment A — Assignment B must treat the skill as "existing" (no "New" tag, no expanded fields), even though no trend/goal UI exists yet to show the student their prior goal.
- A student's current rating is 9 — the auto-suggested goal is 10 (capped at the scale max, since 9 + 2 = 11 would exceed it), and the minimum editable goal is 10 (9 + 1) — so 10 is the only valid goal value in this case.
- A student's current rating is 10 (whether their very first-ever rating of a brand-new skill, or later) — no numeric goal is offered; the new skill's case shows "maintaining this rating" messaging instead, and target date/study plan are still requested for it.
- A student rates a skill 10 on one assignment (their first-ever, "new" rating — count reaches 1), then rates the same skill 10 again on a later assignment (now "existing," plain rating — count reaches 2) — that skill must no longer appear on any assignment submitted after that point, until reactivated.
- A student rates a skill 10 once, then rates it lower than 10 on a later assignment — the skill is not mastered (only 1 of the required 2 ten-ratings), and continues to appear normally.
- A mastered skill is reactivated via the trend page (Phase 4), then rated 10 again on a subsequent assignment — this is only its first 10-rating since reactivation, so it is not yet re-mastered; a second 10-rating after reactivation is required.
- An instructor keeps a mastered skill tagged on assignments (existing or new) — it must still not appear in the rating prompt for the specific student who has mastered it, even though it may still appear normally for other students who haven't.
- A student sets a goal, then clears it back to blank before submitting — the target date and study plan (even if already filled in) are discarded and not saved; only the plain rating is saved.
- A student tries to set a target date equal to today, in the past, or more than two weeks out — these should be rejected/unselectable; only a strictly-future date within the next 14 days is valid.
- A student tries to edit the goal down to equal or below their current rating — this should be rejected/unselectable; the minimum valid goal is always current rating + 1.
- A student picks a rating for a new skill (expanding the fields), then changes their mind and clears the rating before submitting — the expanded fields and anything entered into them must not be saved, and must not reappear pre-filled if they re-rate the skill differently in the same session.
- A student selects "Other" for study plan, types a custom plan, then switches back to a fixed option before submitting — only the fixed option should be saved, not the abandoned free text.
- An assignment has multiple tagged skills where some are new and some are existing for a given student — each skill's card should independently show its own "New" tag and expanded fields based on its own new/existing status, not the assignment as a whole.
- A student enters a rating and expanded-field values, navigates to a different page without submitting, and returns in the same tab — all previously entered values (rating, goal, target date, study plan, "Other" text) should still be present, matching Phase 2's persistence behavior.
- Very many tagged skills on one assignment, several of which are simultaneously "new" and expanded, should not visually break the submission form layout (edge case carried over from Phase 1/2).
- Student Preview or Observer mode viewing a student who has never rated a given skill before should show that skill's "New" tag and, once a rating is present, its expanded goal state (with default suggestions), consistent with Phase 2's read-only-but-accurate treatment — with no way to submit it into existence.

## Acceptance Criteria
- [ ] A skill a student has never rated before (on any assignment) shows a "New" tag as soon as the prompt renders, and the goal-setting section once — and only once — the student enters a rating for it.
- [ ] A skill a student has already rated before (on this assignment or any other) never shows the "New" tag or the expanded fields, regardless of how many assignments it's tagged on.
- [ ] The auto-suggested goal equals the entered rating + 2, capped at 10, and is editable down to a minimum of current rating + 1 (never equal to or below the current rating).
- [ ] When the current rating is 10, no numeric goal input is offered; a new skill's first-ever rating of 10 instead shows "maintaining this rating" messaging, and still requires a target date and study plan.
- [ ] The system tracks, per student/skill, how many times a rating of 10 has been recorded (across both new and existing occurrences), and once that count reaches 2, the skill no longer appears in the rating prompt on any assignment for that student, even if still tagged by the instructor.
- [ ] This phase provides no reactivation UI — a mastered skill can only be brought back via a Phase 4 trend-page control (out of scope here); when it eventually is reactivated, its mastery count resets and its next rating is treated like a brand-new skill again.
- [ ] Clearing the goal to blank makes the target date and study plan not required and not saved — only the plain rating is saved for that skill.
- [ ] The auto-suggested target date is one week from today, is editable, and only accepts a strictly-future date up to two weeks (14 days) out.
- [ ] Study plan offers exactly the seven fixed options listed above, with "Other" revealing a free-text field, and is required whenever a goal is set.
- [ ] Clearing a rating after the expanded fields appear collapses and discards those fields' values.
- [ ] Goal, target date, and study plan are only persisted to the database on actual Submit, never on a Draft save.
- [ ] Entered-but-unsubmitted goal/target date/study-plan values persist across in-app navigation within the same browser tab/window (same mechanism as Phase 2's rating persistence).
- [ ] Submitting a new-skill rating without editing the goal or target date still saves the auto-suggested default values.
- [ ] A rating for a new skill can still be left entirely blank, in which case no goal/target date/study-plan data is shown or saved for that skill (though the "New" tag still shows).
- [ ] The expanded capture only appears when `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` is on, matching Phase 2's gating.
- [ ] Student Preview mode and Observer mode both display the correct new/existing state and expanded fields with real data, but neither can submit the form, so no goal/date/plan data is ever created or changed from those views.
- [ ] If the assignment submission succeeds but a new skill's goal/date/plan fails to save, the student sees a clear, non-blaming error scoped to that failure, distinct from the submission's own success message.
- [ ] No changes in behavior, data, or UI are observable in the existing Confidence Tracker or "Level Up Your Skills" feature as a result of this work.
- [ ] No trend page, kudos, or celebration UI appears as part of this phase.

## Open Questions
<!--
When a question here gets answered (e.g. via an inline PR/file comment), do not delete or replace the question text.
Keep the original question and add the answer beneath it, like:
- <original question>
  - **Answer:** <answer>
This preserves a visible record of what was asked and decided, for anyone reading the spec later.
-->
- What are the study-plan options? (Carried over from the roadmap's open-questions list, already decided there.)
  - **Answer:** the seven options listed in Functional Requirements above (six fixed methods + "Other" write-in), per [`_plans/confidence-tracker-v2-roadmap.md`](../_plans/confidence-tracker-v2-roadmap.md).
- Is providing the goal, target date, and study plan required once a rating triggers the expanded state for a new skill, or can a student give a rating but skip/leave the expanded fields entirely?
  - **Answer:** setting a goal is optional; but if a goal is set, then choosing a study plan and target date is required.
- Does the expanded capture reuse the existing `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` flag from Phase 2, or should it ship behind its own separate flag?
  - **Answer:** reuses the same Phase 2 flag (assumed in this spec, consistent with the roadmap's rollout strategy of one flag covering "everything from Phase 2 onward") — flagging in case a separate flag is wanted for more granular control.
- Is there any minimum or maximum bound on the editable target date (e.g., must it be in the future; is there a cap such as 90 days out), or can a student pick any date at all?
  - **Answer:** must be a future date. Auto-filled at 1 week from today but editable to any future date up to 2 weeks out.
- Should a student be able to set an edited goal lower than their just-entered current rating, or should the goal input enforce goal ≥ current rating?
  - **Answer:** goal must be at least current rating + 1. Auto-filled at current + 2 but editable to be +1 or higher. Cannot be equal to the current rating or lower.
- When the current rating is already 10 (the scale max), no goal value satisfies "at least current + 1" — should goal-setting be unavailable for that skill in this case, or handled some other way (e.g., allowing a goal equal to the current rating just for this edge case)?
  - **Answer:** instead of a new numeric goal, show messaging like "maintaining this rating." Track how many times the student has been rated 10 on that skill; once that happens at least twice, the skill should stop showing up on new assignments (mastered) and goal-setting becomes unavailable for it — unless the student reactivates the skill from the trend page (if they feel their confidence has dropped), which makes it show up on future assignments again and restarts the same flow (rate, set a goal, etc.) as if it were new again. (Reactivation lives on the Phase 4 trend page — noted there as a new scope item; this phase has no reactivation UI of its own.)

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- A skill never before rated by a student shows a "New" tag immediately, and the goal-setting section once a rating is entered.
- A skill previously rated by the student (via this assignment or a different one) never shows the "New" tag or the expanded fields.
- The auto-suggested goal is rating + 2, capped at 10 for a rating of 9; a rating of 10 on a brand-new skill shows "maintaining this rating" messaging instead of a numeric goal, and still requires target date + study plan.
- A skill's 10-rating count accumulates correctly across separate assignments (both its "new" and later "existing" occurrences), and only crosses the mastery threshold at exactly 2.
- Once mastered, a skill is excluded from the tagged-skill list shown to that student on any assignment, even ones newly tagged with it after mastery — while remaining visible normally to other students.
- (Reactivation itself has no UI to test until Phase 4 ships its trend-page control — defer that test coverage to Phase 4.)
- Editing the goal below current rating + 1 is rejected; current rating + 1 is accepted as the minimum.
- Clearing an already-set goal back to blank drops the requirement for target date/study plan and saves only the plain rating.
- The auto-suggested target date is one week from today; dates in the past, today, or beyond two weeks out are rejected.
- Clearing a rating after the fields expand discards any values entered into them.
- Submitting with the goal/target date left at their auto-suggested defaults still saves those default values.
- Submitting with the study plan set to "Other" and custom text saves the free-text value; switching away from "Other" before submitting does not save the abandoned text.
- Saving a Draft with a new-skill rating and expanded fields filled in does not persist any of it to the database; submitting afterward does.
- An assignment with multiple tagged skills, some new and some existing for the student, tags and expands only the new ones.
- Student Preview mode and Observer mode render the correct "New" tag and expanded/non-expanded state per skill, but attempting to submit from either view creates no goal/date/plan data.
