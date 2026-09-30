# Spec for confidence-incremental-kudos

branch: claude/feature/confidence-incremental-kudos

figma-component (if used): N/A

## Summary
This is Phase 5 of the larger confidence-tracking initiative (confidence-tracker-v2; see [`_plans/confidence-tracker-v2-roadmap.md`](../_plans/confidence-tracker-v2-roadmap.md)). Phases 2–3 capture a student's 1–10 confidence rating per tagged skill (on their first submission of an assignment), plus goals and mastery, and Phase 4 ([PR #158](https://github.com/AnnieCannons/ac-lms/pull/158)) added the "My Skill Confidence" student page and the instructor Skill Confidence page. Today a rating that goes up looks exactly like one that stays flat or drops: nothing acknowledges the progress.

This phase adds that first moment of recognition and nothing more. When a student submits an assignment and one of the skills they just rated is higher than their most recent earlier rating of that same skill — even by a single point — they see a short, friendly kudos for that skill, naming the change (for example "from 4 to 6"). There is no question attached: kudos is purely an acknowledgment.

**Scope change made while spec'ing:** the roadmap originally paired incremental kudos with an optional "what helped" prompt on every increase. That prompt has been moved out of this phase. "What helped" is now asked only when a goal is met, which is Phase 6 (goal-met celebration + reminder). This keeps Phase 5 small, avoids asking students a question on every small gain, and gives "what helped" a clearer meaning (what got me to the goal I set). Decisions already made about that prompt (multi-select, add-only answers, the student's own study-plan write-in offered as a choice, instructors seeing answers read-only, no catch-up for older data, same "Other" limits as the study plan) are preserved in the Open Questions below as decisions to carry into the Phase 6 spec. Phase 7 (pattern insights) now depends on Phase 6's data alone.

This phase does not store or display any "what helped" answer, does not detect or celebrate a met goal (Phase 6), and does not change when the rating prompt appears or how goals and mastery work. Everything is gated behind the existing `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` flag, which is still off in production.

## Functional Requirements

### Detecting an increase
- Immediately after a student successfully submits an assignment, each skill they rated on that submission is compared with that same student's most recent earlier rating of the same skill. The comparison spans all of the student's assignments and courses, since skills are shared, and "most recent" means most recently recorded.
- A skill qualifies for kudos when its new rating is higher than that earlier rating, by any amount (even +1). A rating that is equal to or lower than the earlier rating earns no kudos and shows nothing negative, comparative, or "no improvement" wording.
- A skill with no earlier rating has nothing to compare against and earns no kudos. This includes the first rating after a student reactivates a mastered skill: reactivation restarts the skill as if new, so earlier ratings are not compared (confirmed; see Open Questions).
- A skill the student left blank is not compared and shows nothing.
- Ratings are only captured on a first submission (Phase 2), so kudos is evaluated at that moment only; a resubmission never triggers it, and an increase is never re-detected or replayed later.

### Kudos display
- Kudos appears on the confirmation the student sees after a successful submission, clearly tied to the specific skill(s) that improved. Wording is warm, brief, and specific: it names the skill and shows the change from the earlier rating to the new one (confirmed), and never implies the skills that did not improve are a shortfall.
- When several skills improved on the same submission, all of them are recognized together in one place, rather than a stack of separate pop-ups.
- Kudos is non-blocking: it never delays, replaces, or obscures the submission's own success message, and the student can dismiss or ignore it and carry on. It asks the student nothing and requires no action.
- The recognition is announced to screen readers, does not rely on color or animation alone, and any motion respects the reduced-motion preference.
- When a submission's rating save fails (the Phase 2 non-blocking rating error), no kudos is shown for that submission, since the ratings were not recorded.
- Kudos reads as a small, friendly moment, not a large celebration; the larger goal-met celebration belongs to Phase 6.

### Cross-cutting
- Kudos is gated behind `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED`. With the flag off, nothing new appears anywhere.
- Student Preview and Observer mode can never submit a first submission, so they never trigger kudos.
- Nothing is read from or written to the old `confidence_skills`/`confidence_entries` tables or the `skill_tags` ("Level Up Your Skills") fields.
- When an instructor renames a skill, kudos shows the new name.
- Ratings, goals, mastery, reactivation, the "New" / goal-setting behavior, the "My Skill Confidence" page, and the instructor page from Phases 2–4 are unchanged by this phase.
- The kudos is usable on mobile widths, keyboard accessible, and respects the app's existing light/dark and high-contrast theming.

## Figma Design Reference (only if referenced)
- Not applicable — no Figma file was provided. The kudos should follow the app's existing card, alert, and rating-scale visual language and theming.

## Possible Edge Cases
- A student rates a skill 6 after previously rating it 5: kudos appears (+1 counts). A student rates it 5 after 5, or 4 after 5: nothing appears.
- A student rates a skill 10 for the first time after an earlier 7: kudos appears. Rating 10 again after a 10 (the second 10 that makes the skill mastered) is not an increase, so it earns no kudos; any mastery recognition is not part of this phase.
- Several tagged skills on one assignment, some improved, some flat, some dropped, some left blank: only the improved ones appear, together, and the others show nothing.
- The student's most recent earlier rating of a skill came from a different course, or the student was in two courses at once and rated the same skill in both: the comparison always uses the most recently recorded earlier rating regardless of course.
- A skill that was mastered, reactivated, and is now rated again: the first rating after reactivation earns no kudos; later ratings compare against the most recent earlier one as normal.
- A student's rating increase also meets a goal they set: this phase shows the ordinary incremental kudos only and does not detect or celebrate a met goal. Phase 6 will define how the two combine, so this phase must not make that harder (for example, it should not assume kudos is the only celebration a rating can trigger).
- A student closes the tab or navigates away right after submitting without seeing the kudos: it is not shown again later.
- The skill is renamed after the rating: the kudos, shown at submission, uses the current name; no errors if the skill or assignment is later renamed, removed, or deleted, since nothing about kudos is kept.
- The flag is turned off between submitting and the confirmation appearing: no kudos appears and nothing errors.
- Instructor previewing as a student or an observer viewing a student: no kudos, since they cannot submit.
- A very large number of tagged skills improving at once: the kudos stays readable and does not break the confirmation layout.

## Acceptance Criteria
- [ ] After a successful submission, every rated skill whose rating is higher than the student's most recent earlier rating of that skill (by any amount, across all courses) is recognized with a brief, warm kudos naming the skill and the change (for example "from 4 to 6").
- [ ] Skills with an equal or lower rating, no earlier rating (including the first rating after a reactivation), or no rating at all show no kudos and no negative or comparative wording.
- [ ] When several skills improved, they are recognized together in one place.
- [ ] Kudos asks the student nothing: there is no "what helped" question or any other prompt attached to it.
- [ ] Kudos never blocks or replaces the submission's success message, is announced to screen readers, and respects reduced-motion.
- [ ] No kudos is shown when the rating save failed.
- [ ] A resubmission never shows kudos, and kudos is never replayed after the confirmation.
- [ ] Student Preview and Observer mode never show kudos.
- [ ] With `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` off, no kudos appears.
- [ ] Renamed skills, soft-deleted assignments, and deleted skills never cause errors.
- [ ] The kudos works at mobile widths, is keyboard and screen-reader accessible, and respects light/dark and high-contrast themes.
- [ ] No "what helped" prompt or stored answer, goal-met celebration, reminders, notifications, or pattern insights appear as part of this phase.
- [ ] No changes in behavior or data are observable in Phases 2–4 flows (rating capture, goals, mastery, reactivation, trend pages, class overview), the old Confidence Tracker, or "Level Up Your Skills."

## Open Questions
<!--
When a question here gets answered (e.g. via an inline PR/file comment), do not delete or replace the question text.
Keep the original question and add the answer beneath it, like:
- <original question>
  - **Answer:** <answer>
This preserves a visible record of what was asked and decided, for anyone reading the spec later.
-->
- **Scope change:** the "What helped?" prompt originally spec'd for this phase has been moved to Phase 6 and is asked only when a goal is met, not on each increase. The questions and answers directly below about "What helped?" are kept as a record and are decisions to carry into the Phase 6 spec; they do not apply to Phase 5. The questions about reactivation and kudos wording apply to this phase.
- Should the first rating after a student reactivates a mastered skill be able to earn kudos? Reactivation restarts the skill as if new (Phase 3/4), so this spec assumes no earlier rating counts for comparison and no kudos is shown on that first rating. The alternative is to compare against the last rating before reactivation, which could congratulate a student for "improving" on a rating they had themselves said no longer reflected their confidence. Recommendation: no kudos on that first post-reactivation rating.
  - **Answer:** confirmed — no kudos on the first rating after a reactivation.
- Should "What helped?" allow more than one choice per skill? This spec assumes yes, mirroring the multi-select study plan so Phase 7 can compare "planned" with "helped." The alternative is a single choice plus "Other," which is simpler to display and count but forces a student to pick one when several things helped.
  - **Answer:** yes — allow more than one choice per skill.
- Should an explicit "Skip" be recorded differently from simply navigating away? This spec treats both the same ("Not answered yet," answerable later), since the roadmap only requires answered vs. not. Recording an explicit skip separately would allow Phase 6/7 to treat "chose not to say" differently from "never saw it," at the cost of an extra state.
  - **Answer:** no need to record it differently — an explicit skip and navigating away are treated the same ("Not answered yet," answerable later).
- Should a student be able to edit or remove an answer they already gave, or is it final once saved? This spec assumes answers are add-only in this phase (skipped ones can be answered later; answered ones are not changed). Confirm or change.
  - **Answer:** confirmed — answers are add-only in this phase.
- Should instructors and staff see the "what helped" answers on the per-student view in this phase? This spec includes it as read-only, since the data is useful for spotting what is working, and access to this feature's data is already global for those roles. Alternative: keep the answers student-only until Phase 7. Confirm or change.
  - **Answer:** confirmed — instructors and staff see the answers, read-only, in this phase.
- Should ratings that were increases before this phase shipped be offered a catch-up "Add what helped" action? This spec assumes no: only increases recorded after this phase ships can be answered, since older ones were never prompted and the flag is still off in production (so there is likely little real data). Confirm or change.
  - **Answer:** confirmed — no catch-up for increases recorded before this phase ships.
- Should the kudos wording show the numbers (for example "from 4 to 6") or stay general ("your confidence in X went up")? This spec assumes showing the change, since it is specific and warm, but an instructor may prefer general wording so students do not fixate on numeric comparison.
  - **Answer:** show the change (for example "from 4 to 6").
- Should the "Other" write-in (in the "What helped?" prompt, now Phase 6) have a maximum length, and what is it? This spec assumes a modest limit (a sentence or two), matching how study-plan "Other" text is handled.
  - **Answer:** yes — match how the study-plan "Other" text is handled (same length limit and validation).
- Should a student's own study-plan write-in for a skill (the "Other" text they typed when setting a goal) be offered as a choice when asking what helped?
  - **Answer:** yes — if the student wrote their own study-plan option for that skill, it appears as an additional option in that skill's "What helped?" list, so they can confirm it helped without retyping it.
- Should the "My Skill Confidence" page mark rating increases (for example a small neutral "up from 5" note in the dated list), so a student who missed the one-time kudos can still see their progress? This spec assumes not: it changes nothing on the Phase 4 pages, since the chart already shows movement. Recommendation: leave to Phase 6, which is already adding celebration and catch-up items to that page.
  - **Answer:** don't add it — the "My Skill Confidence" page does not mark rating increases.

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- A rating higher than the most recent earlier rating of the same skill (including +1, and across different courses) is detected as an increase; equal, lower, first-ever, and blank ratings are not.
- "Most recent earlier rating" is chosen correctly when the student has rated the skill in multiple courses or at overlapping times.
- The first rating after a reactivation is not treated as an increase, and later ratings compare normally.
- After a successful submission, only the skills that improved show kudos, several improved skills appear together, and each shows the change from the earlier rating to the new one.
- Kudos contains no question or input, does not replace or block the submission success message, and contains no negative or comparative wording for non-improved skills.
- No kudos appears when the rating save failed, on a resubmission, or with the feature flag off.
- Student Preview and Observer never show kudos.
- A renamed skill and a soft-deleted assignment do not cause errors.
- Existing Phase 2–4 behavior (rating capture, goals, mastery, reactivation, trend pages, class overview) is unchanged.
