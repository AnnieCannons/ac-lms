# Incremental Kudos (confidence-tracker-v2, Phase 5)

## Context
Phases 2–4 capture and display per-skill 1–10 confidence ratings, but a rating that goes up looks the same as one that stays flat. Phase 5 (spec: [`_specs/confidence-incremental-kudos.md`](../_specs/confidence-incremental-kudos.md), branch `claude/feature/confidence-incremental-kudos`) adds a one-time, non-blocking kudos on the confirmation a student sees after their first submission: for each rated skill whose rating is higher than their most recent *earlier* rating of that skill (any course), "Your confidence in React went up from 4 to 6." It asks nothing and stores nothing. No kudos for: equal/lower, no earlier rating, blank, the first rating after a reactivation, resubmissions, a failed rating save, flag off, Student Preview/Observer. The "what helped" prompt was moved to Phase 6 and is out of scope. Everything stays behind `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED`.

## Design decisions
- **No migration, no new tables.** The increase is derived at save time from `confidence_tracker_ratings`; nothing is persisted.
- **Compute on the server, inside `saveConfidenceRatings`** (`src/lib/confidence-tracker-actions.ts`), because the prior-rating read must happen *before* the insert and the action already has the auth'd RLS client, the candidate skills, and `progressBySkill`. Return shape widens from `{ error }` to `{ error, kudos?: KudosItem[] }` where `KudosItem = { skillId, from, to }`. All existing early-return paths (no valid ratings, dedupe no-op, no tagged skills, all mastered) return an empty/absent `kudos`, so existing callers and tests keep working.
- **First rating after reactivation** is identified by `progressBySkill.get(skillId)?.is_new_pending === true` at save time (reactivation sets it true; a never-rated skill also has none/true and has no prior rating anyway). Skills with `is_new_pending` true are excluded from comparison. No `reactivated_at` date logic needed.
- **"Most recent earlier rating"** = latest `created_at` (tiebreak `id`) among the student's rows for that skill across all assignments/courses. The current assignment has no rows yet (dedupe guard runs first), so no self-exclusion is needed. No join to `assignments`, so soft-deleted assignments cause no errors.
- **Flag**: the action currently has no flag check (the page gates by passing `confidenceSkills=[]`). Add an `isConfidenceRatingsEnabled()` check that only withholds `kudos` (ratings still save exactly as today), so "flag turned off mid-flow" shows no kudos and no error.
- **Skill names come from the client** (`confidenceSkills` prop already in `SubmissionForm`), keyed by `skillId`; the server returns ids and numbers only.
- **Kudos state is component-local** in `SubmissionForm` and independent of `showRatingPrompt` (which turns false after submit). It is never persisted or replayed; reload/resubmit shows nothing.

## Changes

### 1. Pure logic — new `src/lib/confidence-kudos.ts` (not `'use server'`, Supabase-free)
- `latestPriorRatingBySkill(rows)` — rows `{skill_id, rating, created_at, id}` → `Map<skillId, rating>` (latest wins, tiebreak on id).
- `computeKudos(entries, priorBySkill, progressBySkill)` → `KudosItem[]`: include a skill only if it was rated in this save, `is_new_pending` is not true, a prior rating exists, and `rating > prior`. Order follows the submitted entries.

### 2. Server action — `src/lib/confidence-tracker-actions.ts` (`saveConfidenceRatings`, ~lines 86-180)
- After the mastery gate (line ~134) and before the insert (line ~137): one `confidence_tracker_ratings` select (`skill_id, rating, created_at, id`) `.eq('student_id', user.id).in('skill_id', candidateIds).order('created_at', {ascending:false}).order('id', {ascending:false})`.
- After the insert and progress upsert both succeed, return `{ error: null, kudos }` with `kudos = flagEnabled ? computeKudos(...) : []`. If the prior-rating query itself errors, skip kudos rather than failing the save (kudos is a nicety; never turn a good save into an error).
- If the insert/upsert errors, return the error with no kudos (spec: no kudos when the rating save failed).
- Export the `KudosItem` type from `confidence-kudos.ts`.

### 3. UI
- New `src/components/ui/ConfidenceKudos.tsx`: props `{ items: {skillName, from, to}[]; onDismiss }`. One card for all improved skills (a short list, one line per skill), `role="status" aria-live="polite"`, a visible dismiss button, text-based (not color/animation-only). No inputs, no questions.
- `src/app/globals.css`: a `.kudos-card` class next to `.badge-new` / `.status-grading-card` using the theme-aware teal vars with `color-mix`, so light/dark/high-contrast work with no per-theme overrides. Reduced motion is already handled by the global `prefers-reduced-motion` rule (lines ~417-424); don't add animation that needs more.
- `src/components/ui/SubmissionForm.tsx`: add `kudos` state. In `handleSubmit` (lines ~279-311), use the `saveConfidenceRatings` result: on `error` keep the existing `ratingError` banner and show no kudos; on success map `kudos` ids to names via `confidenceSkills` (drop any id with no matching skill) and `setKudos(...)`. Render `<ConfidenceKudos>` next to the `ratingError` banner (~lines 456-460), above the view-mode block, so the "Turned in" badge and submission content stay visible. Nothing else in the submit flow changes (sessionStorage clearing, draft path, resubmit handlers untouched; drafts and resubmissions never call the action for ratings).
- Student Preview short-circuits `doSave` and Observer has no Submit, so neither can trigger kudos — no extra code.

### 4. Docs
- Add one sentence about kudos to the Confidence Tracker v2 paragraph in `CLAUDE.md`.
- Do **not** mark Phase 5 done in the roadmap until implemented and verified live.

## Tests (`./tests`, Vitest; follow existing conventions)
- New `tests/confidence-kudos.test.ts` (pure): +1 counts; equal/lower/no prior/blank → none; `is_new_pending` (first rating after reactivation) → none; latest-across-courses and same-timestamp tiebreak; multiple improved skills together; mastery 10→10 → none.
- New `tests/save-confidence-ratings.test.ts` (first action-level test for this function; mock `@/lib/supabase/server` and `@/lib/feature-flags` like `tests/reactivate-confidence-skill.test.ts`, with per-table branching in `from()`): returns kudos on an increase; none when the prior query errors; none when insert errors (error returned); none on the dedupe no-op/resubmission; none with flag off while ratings still save; the prior-rating read happens before the insert.
- New `tests/ConfidenceKudos.test.tsx`: shows the change ("from 4 to 6") per skill, no inputs/buttons other than dismiss, `role="status"`, dismiss hides it.
- Extend `tests/SubmissionForm.confidenceRatings.test.tsx`: mocked `saveConfidenceRatings` returning `kudos` shows the card alongside "Turned in"; empty/absent `kudos` shows nothing; rating-save error shows the existing banner and no kudos; Student Preview never shows kudos. Existing assertions keep passing because `kudos` is optional.

## Verification
1. `npm test`, `npm run lint`, `npm run build`.
2. Live check with `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED=true` in `.env.local` and `npm run dev` (browser preview). **Local dev and production share one Supabase database** (flag is off in prod), so use clearly labeled throwaway data and track what is created (cleanup only after asking, see step 3; the `ZZ P4 Browser…` demo skills already exist and are slated for deletion before launch):
   - Rate a skill lower first, then submit a *different* assignment tagged with it at a higher rating → kudos appears with the correct "from → to" beside "Turned in"; flat/lower rating → nothing; two improved skills → one card listing both.
   - First-ever rating of a skill → no kudos. Reactivate a mastered skill (Phase 4 page), rate it → no kudos on that first rating.
   - Resubmitting / reopening the page → no kudos. Flag off → no kudos. Student Preview → no kudos.
   - Check dark mode, high contrast, mobile width, and keyboard/screen-reader announcement.
3. **Do not delete any test data on my own.** List exactly what verification created (ratings, progress rows, submissions, any reactivation) and ask for confirmation before deleting anything; only delete what is approved.

## After approval
Save this plan to `_plans/confidence-incremental-kudos.md` (same name as the spec, like earlier phases) for review, add a plan link to the roadmap's Phase 5 entry, and **do not implement** until told to.
