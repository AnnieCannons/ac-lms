# Growing and Maintaining Skills (confidence-tracker-v2)

## Context
Spec: `_specs/growing-maintaining-skills.md`, branch `claude/feature/growing-maintaining-skills`, flag `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` stays off. Replaces "mastered after two 10s" with a state derived from the latest rating: **Maintaining** = latest rating is 10, otherwise **Growing**. Mastery, the mastery celebration, reactivation, the stored "maintain" goal, the rule that hides mastered skills from assignments and the Mastered/Reactivated chart markers go away. Because the flag is off, no live student is affected.

Saved plan copy goes to `_plans/growing-maintaining-skills.md` for review. Do not implement until the user says so.

## Findings that shape the design
- **Maintaining is derivable, nothing new to store.** `SkillTrend.latestRating` already exists (`src/lib/confidence-trend.ts`). The trend loaders (`confidence-trend-data.ts`) no longer need to read `confidence_tracker_skill_progress` or `confidence_tracker_skill_events`.
- **A stored "maintain" goal breaks the dip case** in four places: `goalStatus === 'maintain'` blocks `canSetGoal` (`confidence-trend.ts:~297`), `getAssignmentSkillsForStudent` treats it as a goal (`confidence-tracker-actions.ts:103`), `saveConfidenceRatings` computes `canSetGoal` the same way (`:300`), and `setSkillGoal` rejects it (`goal-met-actions.ts:113`). Fix: a maintain goal (`goal_is_maintain`, `goal` null) is treated as no goal everywhere. Old maintain rows stay in goal history and still read "Maintaining this rating" there.
- **"What helped" without a goal needs storage.** `confidence_tracker_goal_outcomes.goal_history_id` is `NOT NULL UNIQUE`, and `recordCelebrations`, `findMetGoals`, `setSkillGoal`'s met check and `confidence-trend.ts` (`outcomeByGoal`) all key on it. Before this change "what helped" was never asked without a met goal. User chose a small additive migration to make it optional.
- **Existing mastered or reactivated test rows need no data fix.** A legacy mastered skill has latest rating 10 so it lands in Maintaining. Leftover `is_mastered`, `is_new_pending`, `ten_rating_count`, events and maintain-goal rows are simply ignored. A legacy reactivated skill's old head goal becomes "current" again once the reactivation cutoff is removed; accepted, since it is test data only.
- **The form only sends touched skills** (`SubmissionForm.tsx:292-308` builds entries from `ratings`), so "untouched saves nothing" is natural if untouched maintained skills never enter `ratings`. sessionStorage only holds touched ratings.
- **Kudos** skips a skill with no progress row or `is_new_pending` (`confidence-kudos.ts:45`). The `is_new_pending` part exists only for reactivation and goes.

## Changes

### 1. Migration (additive, idempotent)
`supabase/migrations/20261005000000_confidence_tracker_goal_outcomes_standalone.sql`:
- `ALTER TABLE confidence_tracker_goal_outcomes ALTER COLUMN goal_history_id DROP NOT NULL;` (the UNIQUE constraint still allows many nulls).
- `CREATE INDEX IF NOT EXISTS` on `(student_id, skill_id)` for the standalone lookups.
- No other column changes; nothing dropped. Applied by hand in the Supabase dashboard, and the last item in the pre-launch migration list in the roadmap. Update `SCHEMA.md` (outcomes table, and a note that `is_mastered`, `mastered_at`, `reactivated_at`, `ten_rating_count`, `goal_is_maintain` on progress and the skill events table are no longer used).
- The save path is best-effort, so if the migration is not applied a return to 10 just skips the question.

### 2. Pure logic
- `confidence-tracker-validation.ts`: delete `nextMasteryState`; `validateGoalInput` no longer accepts `'maintain'` and rejects any goal at rating 10 (keep the numeric rules). Remove `'maintain'` from `ConfidenceGoalInput` and `GoalState`.
- `confidence-celebrations.ts`: drop `mastered` and `masteredSkillIds`. `buildCelebrations` produces items of three kinds: **goal met** (numeric goal reached, with outcome id, asks), **returned to 10** (a prior rating below 10, now 10, no met goal: standalone outcome id, asks, `target` null) and **first 10** (no prior rating, short, no outcome). `nextGoalAllowed` stays `rating < 10`. `findMetGoals` ignores maintain rows as before. Add a small helper to detect the "returned to 10" candidates from the prior ratings already read in `saveConfidenceRatings`.
- `confidence-kudos.ts`: skip only when there is no progress row or no prior rating; drop `is_new_pending`. A rise to 10 is still returned and `withoutCelebrated` removes it when the 10 celebration shows (so kudos never shows for a skill that reached 10 from a lower rating).
- New shared helper (e.g. `hasOpenGoal` in `confidence-tracker-actions.ts` or a small lib file): a skill has an open goal only if `progress.goal` is numeric and its newest goal-history row has no outcome. Used by `getAssignmentSkillsForStudent`, `saveConfidenceRatings` and `setSkillGoal`, replacing the duplicated checks.
- `goal-met-notification.ts`: `goalMetReminderMessage` gets a "back at 10" variant (no target) so the bell reads "You're back at 10 in X. Log what helped."

### 3. Server actions
- `getAssignmentSkillsForStudent`: remove the `is_mastered` filter; add `isMaintaining` (latest rating = 10, from the ratings query, which now also selects `rating, created_at`); `canSetGoal = !hasOpenGoal` (so a skill that dipped, or whose goal was met, is offered a goal).
- `saveConfidenceRatings`: remove the mastery filter, `nextMasteryState` and the `ten_rating_count`, `is_mastered`, `mastered_at` writes from the progress upsert (omitted columns are left as they are); `canSetGoal` via the helper; pass prior ratings into `recordCelebrations`. `recordCelebrations` additionally inserts a standalone outcome (null `goal_history_id`, `met_rating` 10, `met_assignment_id`) plus the bell reminder for each "returned to 10" skill; the first-submission guard already makes this one-time per assignment.
- `goal-met-actions.ts`: `setSkillGoal` drops the `is_mastered`, `is_new_pending` and `goal_is_maintain` guards and the `.eq('is_mastered', false)` update filter; allowed when the latest rating is below 10 and `!hasOpenGoal`. `answerWhatHelped` already tolerates a missing goal row (`ownPlanText` becomes null); make the `goal_history_id` lookup skip when it is null.
- Delete `confidence-trend-actions.ts` (`reactivateConfidenceSkill`) and `tests/reactivate-confidence-skill.test.ts`.

### 4. Trend model and loaders
- `confidence-trend.ts`: remove `EventRow`, `ProgressRow`, `TrendEvent`, the event/marker block, `isMastered`, `previouslyMastered`, `masteredDates`, `reactivatedDates`, `pendingNew` and the `lastReactivation` cutoff. Add `isMaintaining` (`latestRating === 10`). A maintain head goal is never current (`goalStatus` 'none'; keep `isMaintain` on `TrendGoal` only for old history rows). `canSetGoal = latestRating < 10 && (goalStatus is 'none' or 'met')`. Add `reachedTens` (standalone outcomes per skill: id, date, answered, what helped); `unansweredMetGoals`, `UnansweredGoal.target` (nullable) and the patterns inputs include them.
- `confidence-trend-data.ts`: stop querying progress and events; also fetch standalone outcomes (they are already in the outcomes query, now with null goal ids).
- `confidence-patterns.ts` (`WhatHelpedPatterns`, `computeClassPatterns`): count standalone outcomes alongside goal outcomes; their "own plan" text is null.

### 5. Submission form
- `ConfidenceRatingPrompt.tsx`: split `skills` into maintained (`isMaintaining`) and the rest. Rest render as today. Maintained skills render in one collapsed disclosure ("Still feeling confident on: HTML, Git", `aria-expanded`), expanding to the usual rating boxes showing 10 as a muted "current" state that is **not** in `ratings`. Clicking any number (including 10) makes it an explicit rating; clicking it again returns to the untouched state. Goal fields show right in that box for a rating below 10 when `canSetGoal`, as for any skill. Remove the `'maintain'` goal logic (`handleRatingClick`, `suggestedGoal` at 10, `GoalFields.tsx`).
- `SubmissionForm.tsx`: remove the `maintaining` state and `ConfidenceMaintaining` (delete the component and `ConfidenceKudos`'s `maintaining` prop); pass the new celebration kinds through; `isGoalIncomplete` unchanged apart from dropping `'maintain'`.
- `GoalMetCelebration.tsx`: replace `mastered` with a `kind`; headlines: "You reached your goal of N in S!", "You're back at 10 in S!" (asks what helped, with the existing `WhatHelpedForm`), "You're at 10 in S!" (short, no question). Remove the "won't show up on your assignments again" text.

### 6. My Skill Confidence page
- `SkillConfidenceView.tsx`: sections `id="skills-growing"` "Skills you're growing" and `id="skills-maintaining"` "Skills you're maintaining", each with its own picker, copy and empty state; split by `isMaintaining`. Remove `masteredSel`, the Reactivate modal and `reactivateConfidenceSkill`. Rename the leftover `canReactivate` prop to `canEdit` (page passes `!isStaff`). Drop selected ids that no longer belong to a section after a move. `skillActions` text handles a null target ("You got back to 10 in S. Log what helped.") and the "Log what helped" list modal likewise.
- `SkillTrendCard.tsx`: remove the Mastered and Previously-mastered notes and `pendingNew`; the Maintaining card shows "You're maintaining this rating" plus a gentle note that the rating can be lowered on a future assignment if it no longer feels like a 10, with no Set-a-goal control. Instructor cards share the card, so they follow with no extra change.
- `SkillTrendChart.tsx`: remove the event `ReferenceLine`s and the marker comment; course dividers and the goal line stay.
- `NotificationBell.tsx`: no change (the type and `#what-helped` link are unchanged).

### 7. Docs
- `CLAUDE.md` Confidence Tracker paragraph: replace the mastery and reactivate wording with Growing and Maintaining.
- Roadmap: the idea entry already exists; after the work is built, mark it built and add the new migration to the pre-launch checklist (no phase rewritten).

## Tests (`./tests`, Vitest)
- **Update:** `confidence-trend.test.ts` (drop mastered, reactivated and marker cases; add Maintaining at 10, 10 then 7 back to Growing, maintain goal ignored, `canSetGoal` after a dip, standalone outcomes); `SkillConfidenceView.test.tsx` and `SkillConfidenceInstructorView.test.tsx` (new sections and titles, no Reactivate, Maintaining note, null-target follow-up); `get-assignment-skills.test.ts` (invert the mastered-exclusion test; `isMaintaining`, `canSetGoal` after a dip or a met goal); `save-confidence-ratings.test.ts` (no mastery, standalone outcome and reminder on return to 10, first 10 short with no outcome, no kudos on a rise to 10, an explicit 10 on a maintained skill saves with no celebration); `confidence-celebrations.test.ts`, `confidence-kudos.test.ts`, `confidence-tracker-validation.test.ts` (remove `nextMasteryState` and maintain-goal cases), `goal-met-actions.test.ts` (no mastered guards, allowed after a dip with an old maintain goal), `GoalMetCelebration.test.tsx`, `ConfidenceKudos.test.tsx`, `ConfidenceRatingPrompt.test.tsx`, `SubmissionForm.confidenceRatings.test.tsx` (collapsed maintained row at 10, untouched sends nothing, lower rating sends it with goal fields inline), `confidence-patterns.test.ts` and `WhatHelpedPatterns.test.tsx` fixtures, `SkillTrendChart.test.tsx` fixture, `NotificationBell.test.tsx` only if the message text changes.
- **Delete:** `reactivate-confidence-skill.test.ts`.

## Verification
1. `npm test`, `npm run lint`, `npm run build`.
2. Apply the migration by hand in the Supabase dashboard, then on a dev server with the flag on (asking before any write to the shared database): view My Skill Confidence as the test student (legacy mastered skills in Maintaining, no Reactivate, chart points only); Student Preview of a tagged assignment (collapsed maintained row at 10, expand, lower a rating and see goal fields). A real submission is a write to shared data, so ask first and log any test rows for the pre-launch cleanup list.
3. Flag off: both pages 404 and no prompt appears, as before.
