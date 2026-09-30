# Spec for confidence-goal-met

branch: claude/feature/confidence-goal-met

figma-component (if used): N/A

## Summary
This is Phase 6 of the larger confidence-tracking initiative (confidence-tracker-v2; see [`_plans/confidence-tracker-v2-roadmap.md`](../_plans/confidence-tracker-v2-roadmap.md)). Phases 2–3 capture a student's 1–10 confidence rating per tagged skill on their first submission of an assignment, plus an optional goal (target rating, target date, study plan). Phase 4 ([PR #158](https://github.com/AnnieCannons/ac-lms/pull/158)) added the "My Skill Confidence" page and the instructor Skill Confidence page, and keeps goals as history. Phase 5 ([PR #161](https://github.com/AnnieCannons/ac-lms/pull/161)) added a small, one-time kudos when a rating goes up. Today, when a student reaches the goal they set, nothing notices: the goal just sits there and the student is never asked what got them there or what to aim for next.

This phase adds the larger moment of recognition and the reflection that goes with it:

1. **Goal-met celebration.** When a rating a student gives on submission meets or exceeds the current goal for that skill, they see a warmer celebration than Phase 5's kudos, naming the skill and the goal they reached. Reaching mastery (the second rating of 10, per Phase 3) gets its own celebration, letting the student know they have mastered the skill (mastery is celebrated but never asks "what helped").
2. **"What helped" prompt.** The celebration asks, optionally, what helped the student reach the goal. This is the only place "what helped" is ever asked (moved here from Phase 5). The student can pick more than one answer or skip. Answers are stored so Phase 7 can later surface personal patterns.
3. **Catch-up and reminder.** A skipped (or walked-away-from) "what helped" stays answerable later: it appears as an actionable follow-up on My Skill Confidence, and, if it is still unanswered at the start of the next day, the student gets a reminder in the existing in-app notifications (the bell only).
4. **Next goal.** Once a goal has been met, the student can set a new one for that skill, following the same rules as at submission. The same "set a goal" control also serves skills that never had a goal (skipped at submission), from My Skill Confidence. Every new goal is appended to the Phase 4 goal history, never overwriting an earlier one.

Instructors and staff see the "what helped" answers read-only on the per-student view of the instructor page. Everything is behind the existing `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` flag, which is still off in production. The flag stays off until every phase of the initiative is complete (there may be phases beyond Phase 7), and it is not turned on without asking first.

This phase does not add pattern insights (Phase 7), does not backfill or prompt for goals met or skills mastered before it ships, and does not change when the rating prompt appears or the rules for when a skill becomes mastered (it only celebrates it).

## Functional Requirements

### Detecting a met goal
- Immediately after a student successfully submits an assignment for the first time, each skill they rated is checked against that student's **current goal** for that skill (the most recent goal in that skill's goal history, per Phase 4). A goal is met when the new rating is **equal to or higher than** the goal's target rating.
- A goal is met **at most once**. After it is met, that goal is closed as met and is not celebrated or asked about again, even if the student's rating later drops and rises again.
- The goal's target date does not affect whether it is met: a goal reached after its target date is still met and celebrated, with no "late" or "overdue" wording. Reaching a goal before its target date is not treated differently either.
- A skill with no goal, a skill whose goal was already met, or a skill left blank on this submission is not checked and shows nothing.
- A "maintaining this rating" goal (a skill first rated 10) has no target to reach, so it is never "met". That student's next rating of 10 makes the skill mastered (two ratings of 10, unchanged from Phase 3), which has its own celebration (see Mastery celebration below).
- Ratings are only captured on a first submission (Phase 2), so a goal can only be met at that moment or, in the case of a goal set later from My Skill Confidence, on a later assignment's first submission. A resubmission never triggers the celebration.
- The comparison spans courses, since skills and goals belong to the student and skill, not the course.
- When the rating save fails (the existing non-blocking rating error), no celebration is shown and the goal is not marked as met, since the rating was not recorded.

### Goal-met celebration and "what helped"
- The celebration appears on the confirmation the student sees after submission, next to "Turned in", like Phase 5's kudos. It is non-blocking: it never delays, replaces, or hides the submission's success message, and the student can dismiss it.
- It is warm and specific: it names the skill, the goal that was reached (for example "You reached your goal of 7 in React"), and, where the rating went beyond the goal, does not make the student feel they overshot or undershot.
- It is a larger moment than Phase 5's kudos, but still restrained and text-based. It is announced to screen readers, does not rely on color or animation alone, and respects the reduced-motion preference.
- When several skills meet goals or reach mastery on one submission, they are celebrated together in one place, each met goal with its own "what helped" question, rather than a stack of separate pop-ups.
- **Combining with kudos:** if a skill both improved (Phase 5) and met its goal or reached mastery, the student sees the goal-met or mastery celebration for that skill, not a second, separate kudos line for it (confirmed: the celebration replaces kudos). Improved skills that did not meet a goal still show the ordinary Phase 5 kudos, together in the same place.
- For each celebrated skill, the celebration asks "What helped you get there?" as an optional multi-select from a fixed list, with an "Other" write-in. The fixed options, from the roadmap, are:
  1. Practicing on my own
  2. Reviewing the lesson materials
  3. Getting help from a TA or instructor
  4. Outside tutorials or videos
  5. Studying flashcards
  6. Reviewing class notes
  7. Other (write-in)
- The student may choose more than one option for a skill.
- If, when setting the goal, the student wrote their own "Other" study plan for that skill, that text is offered as an additional option in that skill's list, so they can confirm it helped without retyping it.
- The "Other" write-in follows the same length limit and validation as the study plan's "Other" text.
- The student can save an answer, or skip. **An explicit skip and simply walking away are treated the same**: the skill's "what helped" is "Not answered yet" and can be answered later. Nothing distinguishes the two.
- The celebration itself is never replayed. If the student does not answer, the only way back to the question is the follow-up on My Skill Confidence (below).
- Answers are **add-only**: once saved, an answer is not edited or removed in this phase. A skipped one can be answered later, once.
- Answering asks nothing further and has no effect on the student's rating, goal history, or mastery.

### Mastery celebration
- When a rating of 10 on a first submission is the second recorded 10 that makes the skill mastered (the Phase 3 rules, unchanged), the student sees a mastery celebration in the same place and style as the goal-met celebration, naming the skill and letting them know they have mastered it (for example "You've mastered React!").
- The mastery celebration is a celebration only: it does **not** ask "what helped" and stores nothing. There is no mastery follow-up on My Skill Confidence and no mastery reminder. ("What helped" is asked only for met goals.)
- A rating of 10 that neither meets a numeric goal nor completes mastery is not celebrated on its own (only Phase 5's ordinary kudos applies if it is an improvement). In particular, a first 10 on a skill with a "maintaining" goal is not celebrated; the second 10 is.
- A first 10 that meets a numeric goal (for example a goal of 10, or a lower goal the rating exceeds) is celebrated as a met goal, not as mastery. The later second 10 is the mastery celebration.
- If one rating both meets a numeric goal of 10 and completes mastery, the student sees a single mastery celebration that also acknowledges the goal reached. Because a goal was met, the "what helped" question is asked once, for that goal, with its usual follow-up and reminder. The goal is closed as met.
- The mastery celebration replaces kudos for that skill, and does not offer a next goal (a mastered skill has no goal-setting). It may mention that the skill can be brought back from My Skill Confidence if the student ever feels their confidence has dropped (Phase 4's reactivate).
- A skill that is mastered, reactivated, and mastered again is celebrated each time mastery is reached.
- Skills mastered before this phase ships get no celebration (no catch-up).

### Setting a next goal
- After a goal is met, the student can set a new goal for that skill. It is offered in the goal-met celebration as an optional, skippable step shown after the "what helped" question (confirmed), and it is always available from My Skill Confidence. It is not offered after mastery.
- A new goal follows the same rules as at submission: target rating at least the current rating plus one and no higher than 10 (auto-suggested at the current rating plus two, capped at 10, editable), a target date that is strictly in the future (auto-suggested one week out, no upper bound), and at least one study-plan choice (with an "Other" write-in), all required together. Leaving the goal blank sets nothing.
- If the student's current rating is already 10, no numeric goal is offered, and the same "maintaining this rating" wording as at submission is used, with no target date or study plan requested.
- A new goal is appended to the skill's goal history; earlier goals, including met ones, stay viewable with their dates. Nothing is overwritten.
- Only one goal per skill is current at a time. A new goal can be set only when the skill has no current goal, or its current goal has been met. A skill with an open, unmet goal cannot be given a second goal.
- The same "Set a goal" control on My Skill Confidence also serves a skill that never had a goal (skipped at submission), fulfilling the idea noted in the roadmap. This works even if the skill's rating is unchanged since it was given.
- Setting a goal is available only to the student it belongs to, is verified server-side (not merely hidden in the UI), and repeating it (such as a double click) does not create a duplicate goal.
- Mastered skills have no goal-setting; reactivating a skill restarts goal capture as in Phase 4, and that flow is unchanged.
- Goal-setting is unavailable in Student Preview and Observer mode: the control may show its accurate state but cannot be used.

### "What helped" follow-up on My Skill Confidence
- For each met goal whose "what helped" is not yet answered, the student's My Skill Confidence page shows a clear, friendly, actionable item (for example "You reached your goal of 7 in React. What helped?") that opens the same question as in the celebration.
- The follow-up sits with the skill it belongs to and is also summarized near the top of the page so it is easy to find; the wording is inviting, not nagging, and never implies a student has fallen short.
- Once answered, the follow-up disappears and the answer is shown, read-only, with the met goal in that skill's goal history, with the date it happened.
- A met goal that was answered shows the chosen options exactly as worded when chosen, including any "Other" text.
- Goals met before this phase ships are not given a follow-up or reminder (no catch-up for older data).
- The "what helped" follow-up on My Skill Confidence (both the item beside the skill and the summary at the top of the page) is only shown when the flag is on.
- An unanswered "what helped" stays until answered; it does not expire (confirmed).

### Reminder through notifications
- When a goal is met and the student has not answered "what helped" by the start of the next day (because they skipped or walked away), the student receives one reminder in the existing `notifications` system, created at 12:00 a.m. in the student's own timezone, when their next day begins. The student's timezone is the one recorded with the submission on which the goal was met, the same timezone the app already captures from the student's browser to decide whether work is late. If no timezone was recorded, the reminder is created no earlier than midnight anywhere in the world, matching how the app already treats an unknown timezone for optional-assignment due dates, so it never arrives early. It is not created if the student answers first. Once created, it stays in the notification bell, like any other notification, so it is there whenever the student next opens the LMS, until they read it or answer the question.
- The reminder is warm and specific to the skill and goal, and links to the follow-up on My Skill Confidence.
- There is one reminder per met goal at most, never a repeating series. It is not created when the student answered at the celebration or at any point before it is due.
- Answering the follow-up after the reminder has appeared marks the reminder as no longer needed, so an unread reminder does not linger asking a question that is already answered.
- Reminders are only created when the flag is on and only for goals met after this phase ships.
- Reminders appear in the in-app bell only. They are not included in the existing daily digest email (confirmed). Existing notification behavior (types, read/unread, the digest for other notifications) is otherwise unchanged.
- Instructors and staff never receive these reminders.

### Instructor and staff visibility
- On the per-student view of the instructor Skill Confidence page, for each skill the student's history shows which goals were met and when, when the skill was mastered, and any "what helped" answer for a met goal, read-only. An unanswered met goal shows "Not answered yet."
- Instructors and staff cannot answer, edit, or set goals on a student's behalf; those are student-only actions.
- The class overview figures are unchanged. TAs are still excluded from this feature's data, as in Phases 1–4.

### Cross-cutting
- The celebration, the follow-up, the reminder, and goal-setting from the trend page are all gated behind `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED`. With the flag off, nothing new appears anywhere, and ratings still save exactly as before. Because the trend-page and notification surfaces sit outside the submission form, each needs its own explicit check against the same flag.
- Student Preview and Observer mode can never submit a first submission, so they never trigger the celebration or a reminder, and they cannot answer or set goals.
- Nothing is read from or written to the old `confidence_skills`/`confidence_entries` tables or the `skill_tags` ("Level Up Your Skills") fields.
- When an instructor renames a skill, the celebration, the follow-up, the reminder text created afterward, and the history show the new name. When an assignment is renamed, the student sees the new name wherever it is shown in their history.
- Phase 5's kudos, Phase 4's reactivation and mastery, Phase 3's goal capture, and the class overview keep working as before, apart from the combined behavior described above.
- All new UI works at both desktop and mobile widths, is keyboard and screen-reader accessible, and respects the app's existing light/dark and high-contrast theming. (Mobile is named because students often use phones; desktop is equally required.)
- Phase 7 depends on the answers stored here; how they are stored should keep each answer tied to one met goal and one skill so patterns can later be grouped by method and compared with the rating change.

## Figma Design Reference (only if referenced)
- Not applicable — no Figma file was provided. The celebration and follow-up should follow the app's existing card, alert, and rating-scale visual language and theming, and read as a step up from Phase 5's small kudos card without becoming a large or loud celebration.

## Possible Edge Cases
- A student rates a skill exactly at their goal (goal 7, rating 7): the goal is met. A rating above the goal (goal 7, rating 9): also met. A rating below (goal 7, rating 6): not met, and only ordinary Phase 5 kudos applies if it improved.
- A student meets a goal and also improved: only the goal-met celebration shows for that skill, not a duplicate kudos line.
- A skill's goal is met, but that skill has no earlier rating comparison (for example the first rating after a reactivation with a goal set from the trend page before rating): the goal-met celebration still applies, since it depends on the goal, not on Phase 5's comparison.
- A student rates a skill 10 and it meets a numeric goal of 10: the goal is met and celebrated like any other met goal, with the "what helped" question. A later second 10 is celebrated as mastery, with no question. If a single rating is both (a goal of 10 met by the second 10), one mastery celebration acknowledges both and the "what helped" question is asked once for the goal; no next goal is suggested for the now-mastered skill.
- A student's first-ever rating of a skill is 10 ("maintaining"): nothing is celebrated. Their next rating of 10 is the mastery celebration. A 10 in between that is lower than 10 is not an increase to celebrate.
- A goal is met but the student skips: "Not answered yet" appears on the follow-up, one reminder is created at 12:00 a.m. the next day in the student's timezone if it is still unanswered and stays in the bell until read or answered, and answering removes both the follow-up and the need for the reminder. If the student answers before then, no reminder is ever created.
- A student answers "what helped" from the follow-up in two tabs, or double clicks: a second answer for the same met goal is a harmless no-op and never adds or changes options.
- A student meets goals on several skills at once and answers some but not others: each skill is independent; unanswered ones get their own follow-up and reminder.
- A goal's target date passed long ago and the goal is now met: celebrated normally, with no "late" wording.
- A goal is met on a skill the student had previously mastered and reactivated: the goal in question is the one set after reactivation, per Phase 4's history.
- The student's own study-plan "Other" text is offered as an option; if that goal had no "Other" text, no extra option appears. If the text is long, it is displayed readably without breaking the layout.
- A student picks "Other" for "what helped" and types text, then deselects "Other" before saving: only the remaining options are saved, and the abandoned text is not.
- A skill is renamed or deleted from the shared taxonomy after a goal was met: nothing errors; deleted skills cascade away with their history as in Phase 4; the reminder's link leads to My Skill Confidence, which simply no longer lists the skill.
- The assignment where the goal was met is later renamed: the student sees the new name everywhere it is shown. If it is soft-deleted, the answer and history remain, shown with a neutral label.
- The flag is turned off after a goal was met but before it was answered: the follow-up, celebration, and set-a-goal actions are hidden or rejected with a clear message, and no reminder is created. Stored data is kept.
- A student sets a new goal for a skill from My Skill Confidence while the "what helped" for that same skill's earlier met goal is still unanswered (or for a different skill's unanswered item): they are independent. The earlier follow-up and any reminder remain until answered, and the new goal is simply added to the history.
- A skill's goal history contains earlier goals: only the current goal, the most recent one, is checked. Older goals in the history are closed or superseded and are never celebrated retroactively.
- A student set a goal from the trend page and the current rating already meets it: a goal must be at least the current rating plus one, so this cannot happen at setting time; the goal can only be met by a later rating.
- A very large number of goals met on one submission: the celebration remains readable and does not break the confirmation layout.
- An instructor previewing as a student or an observer viewing a student: sees accurate state, with no way to answer or set goals, and never triggers a celebration or a reminder.
- Instructor views a student with a met, unanswered goal: shown as "Not answered yet," never as a shortfall.

## Acceptance Criteria
- [ ] After a successful first submission, every rated skill whose rating is equal to or higher than the student's current goal for that skill is celebrated, naming the skill and the goal reached, with no "late" or "overdue" wording.
- [ ] A goal is met at most once; a met goal is closed and never celebrated or asked about again.
- [ ] Skills with no goal, an already-met goal, a "maintaining" goal, or no rating on this submission show no goal-met celebration.
- [ ] Reaching mastery (the second 10) is celebrated, naming the skill as mastered, but never asks "what helped" and creates no follow-up or reminder; a first 10 that neither meets a goal nor completes mastery is not celebrated on its own; one rating that is both a met goal and mastery shows a single mastery celebration and asks "what helped" once, for the goal.
- [ ] Several met goals or masteries on one submission appear together in one place, and a skill that both improved and met its goal or reached mastery shows only the celebration for that skill, not a separate kudos line.
- [ ] The celebration never blocks or replaces the submission's success message, is announced to screen readers, respects reduced-motion, and can be dismissed.
- [ ] No celebration is shown and no goal is marked met when the rating save failed, on a resubmission, or with the flag off.
- [ ] Each celebrated skill offers an optional multi-select "what helped" with the seven fixed options, the student's own study-plan "Other" text as an extra option when one exists, and an "Other" write-in that follows the study plan's length and validation.
- [ ] Skipping and walking away are treated the same: the answer is "Not answered yet" and can be given later.
- [ ] Answers are add-only: once saved, they cannot be edited or removed; a repeated or duplicate answer for the same met goal is a harmless no-op.
- [ ] An unanswered met goal appears as an actionable "what helped" follow-up on My Skill Confidence (with the skill and also summarized near the top), stays until answered, and disappears once answered; the answer then shows read-only in that skill's history with the date it happened.
- [ ] When a met goal's "what helped" is still unanswered at the start of the next day (12:00 a.m. in the student's timezone), exactly one reminder appears in the notification bell (and not in the digest email), linking to the follow-up, and stays there until read or answered; answering after that means the reminder no longer asks an already-answered question; no reminder is created when the student answered before it was due.
- [ ] Goals met before this phase ships get no follow-up or reminder, and skills mastered before it ships get no celebration.
- [ ] A student can set a new goal for a skill with no current goal or with a met goal, from the celebration (optionally) and from My Skill Confidence, following the same rules as at submission (minimum current plus one, capped at 10, future target date, at least one study plan; "maintaining" when the rating is 10).
- [ ] A new goal is appended to the goal history; earlier goals, including met ones and their answers, remain viewable with their dates.
- [ ] A skill with an open, unmet goal cannot be given a second goal; repeating the set-a-goal action does not create duplicates.
- [ ] Setting a goal and answering "what helped" are verified server-side, available only to the owning student, and unavailable in Student Preview and Observer mode.
- [ ] Instructors and staff see met goals, masteries, and "what helped" answers, read-only, on the per-student view, with "Not answered yet" where applicable, and cannot answer or set goals for a student; TAs remain excluded; the class overview is unchanged.
- [ ] Instructors and staff never receive these reminders.
- [ ] With `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` off, no celebration, follow-up, reminder, or set-a-goal control appears anywhere, and the corresponding actions are rejected; ratings still save.
- [ ] Renamed skills, soft-deleted assignments, and deleted skills never cause errors.
- [ ] All new UI works at desktop and mobile widths, is keyboard and screen-reader accessible, and respects light/dark and high-contrast themes.
- [ ] No pattern insights appear as part of this phase, and no behavior or data changes are observable in Phase 2–5 flows beyond the combined goal-met and kudos behavior, the old Confidence Tracker, or "Level Up Your Skills."

## Open Questions
<!--
When a question here gets answered (e.g. via an inline PR/file comment), do not delete or replace the question text.
Keep the original question and add the answer beneath it, like:
- <original question>
  - **Answer:** <answer>
This preserves a visible record of what was asked and decided, for anyone reading the spec later.
-->
- Should the goal-met celebration replace Phase 5's kudos for that skill (assumed here, so a student does not see two messages for one rating), or appear alongside it? Recommendation: replace, since the goal-met message already acknowledges progress.
  - **Answer:** replace — the goal-met celebration replaces Phase 5's kudos for that skill (and so does the mastery celebration).
- Should the celebration offer "set your next goal" right away, or leave it to My Skill Confidence? This spec assumes it is offered as an optional, skippable step in the celebration (so momentum is not lost) and is always available on the trend page. The alternative is trend page only, which keeps the celebration to a single question. Recommendation: offer it, but only after the "what helped" question, and keep both skippable.
  - **Answer:** recommendation accepted — offered after the "what helped" question, both skippable, and always available on the trend page. Not offered after mastery.
- When should the reminder be sent: immediately when the student skips or walks away, or after a delay (for example a day or two later, if still unanswered)? An immediate reminder is simple but can arrive while the student is still on the page; a delayed one is friendlier but needs a scheduled job, like the existing cron routes. Recommendation: to be decided; an immediate notification is the smaller option.
  - **Answer:** at 12:00 a.m. in the student's own timezone when their next day begins, in notifications, only if the student has not already answered. The reminder stays in the bell whenever they open the LMS.
- Should the reminder be included in the existing daily notification digest email (the `emailed_at` mechanism), or appear only in the in-app bell? This spec assumes the bell only, so a nudge about a reflective question does not become email. Confirm or change.
  - **Answer:** bell only — not included in the digest email.
- Which timezone is "12:00 a.m. the next day" measured in? The app does not store a timezone on the student's profile, but it already records the student's browser timezone on each first submission (used for due dates and lateness, and with a fallback for an unknown timezone).
  - **Answer:** use the student's timezone, taken from the submission on which the goal was met, like assignment due dates. When none was recorded, use the same fallback as due dates (the latest timezone on earth), so the reminder is never early. No new profile setting is added.
- Should an unanswered "what helped" expire (for example the follow-up disappears after some weeks), or stay until answered? This spec assumes it stays until answered, since it is low-pressure and is the source data for Phase 7.
  - **Answer:** stays until answered.
- Should a goal that is met also be recorded when the student's later rating drops below it (for example, a "goal reached, now slipped" note)? This spec assumes no: a met goal is simply met, and the trend chart already shows later movement.
  - **Answer:** assumption confirmed — a met goal is simply met.
- How should the "maintaining" goal and a numeric goal of 10 differ in this phase? This spec assumes only numeric goals can be met, and that a numeric goal of 10 is celebrated when met like any other, even when that rating also completes mastery. Confirm, or decide how mastery and goal-met should be worded together.
  - **Answer:** a numeric goal of 10, once met, is celebrated like any met goal. A later 10 is not celebrated until it completes mastery (the second 10), and mastery is celebrated with its own message, but unlike a met goal it does not ask "what helped" (no follow-up or reminder).
- Should a student be allowed to replace an open, unmet goal with a different one (for example, after realizing it was too ambitious)? This spec assumes no, since Phase 3 made goals permanent once captured and Phase 4 keeps them as history; a new goal is possible only after the current one is met. Confirm or change.
  - **Answer:** confirmed — no replacing an open goal; a new goal only after the current one is met.
- Should an instructor see a class-level view of how many students reached goals or answered "what helped"? This spec assumes not in this phase; instructors see per-student answers only, and aggregate views are left to a later idea alongside the "needs attention" count.
  - **Answer:** assumption confirmed — per-student answers only in this phase.

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- A rating equal to or higher than the current goal is detected as met; a rating below, a skill with no goal, a "maintaining" goal, an already-met goal, and a blank rating are not.
- Only the most recent goal is checked, and a goal is met at most once even if the rating later drops and rises again.
- A goal met on the same skill that also improved shows the goal-met celebration and not a separate kudos line; improved skills that did not meet a goal still show kudos, together.
- Several met goals appear together, each with its own "what helped" question, and the celebration does not block or replace the submission's success message.
- No celebration and no met goal is recorded when the rating save failed, on a resubmission, with the flag off, or in Student Preview and Observer.
- The "what helped" list shows the seven fixed options, adds the student's own study-plan "Other" text for that skill when one exists, allows more than one choice, and applies the study plan's length and validation to "Other."
- Skipping and walking away are treated the same; answering later works once, and a repeated answer is a harmless no-op that changes nothing.
- An unanswered met goal appears as a follow-up on My Skill Confidence and disappears once answered, with the answer shown read-only in the goal history.
- Reaching mastery (second 10) shows the mastery celebration with no "what helped" question, follow-up, or reminder; a first 10 that meets no goal and completes no mastery shows none; a rating that is both a met goal and mastery shows one celebration and asks "what helped" once, for the goal.
- A reminder notification is created once, at the start of the next day, for an unanswered met goal and stays until read or answered; it is not created when answered before it is due, not included in the digest email, and never created with the flag off or for goals met before this phase.
- Setting a new goal after a met goal, and setting a first goal from the trend page, follow the submission rules (minimum current plus one, capped at 10, future target date, study plan required, maintaining at 10) and append to the goal history without overwriting earlier goals.
- A skill with an open, unmet goal cannot get a second goal, and a repeated set-a-goal action creates no duplicate.
- Answering and setting a goal are rejected for the wrong student, for Student Preview and Observer, and with the flag off.
- The instructor per-student view shows met goals and answers read-only, shows "Not answered yet" where applicable, and offers no answer or goal-setting controls; TAs remain excluded.
- A renamed skill and a soft-deleted assignment do not cause errors.
- Existing Phase 2–5 behavior (rating capture, goals, mastery, reactivation, kudos, trend pages, class overview) is unchanged apart from the combined goal-met and kudos behavior.
