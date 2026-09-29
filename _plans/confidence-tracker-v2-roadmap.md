# Confidence Tracker v2 — Phased Roadmap

## Context
This is a new, self-contained feature that prompts students to rate their confidence on skills right after submitting an assignment, tracks how that confidence changes over time, and celebrates progress. It's built as a phased rollout — each phase ships and is verifiable on its own before the next begins.

It's deliberately kept separate from two unrelated, pre-existing systems that also involve the word "skill":
- **`confidence_skills`/`confidence_entries`** — the original Confidence Tracker, a per-student free-text list students maintain themselves (`/student/confidence`, `/instructor/courses/[id]/confidence`). Untouched by this initiative.
- **`assignments.skill_tags`/`modules.skill_tags`** — powers the unrelated "Level Up Your Skills" student browsing/filtering feature. Untouched by this initiative.

New tables/UI use the `confidence_tracker_*` naming to avoid colliding with either.

## Phase 1 — Skill tagging foundation ✅ Done (merged)
- New canonical, shared skill taxonomy: `confidence_tracker_skills` + `confidence_tracker_assignment_skills` (join table), with case/whitespace/punctuation-insensitive dedup.
- Instructor-facing "Confidence Skills" field in the Assignment Editor — creatable multi-select combobox (type to filter, click/Enter to select, Enter on no match to create), with inline rename support (a rename applies globally since the skill is shared).
- Access gated to admin/instructor/staff; TAs excluded.
- No student-facing behavior yet.
- Spec: [`_specs/assignment-skill-tagging.md`](../_specs/assignment-skill-tagging.md) · Plan: [`_plans/assignment-skill-tagging.md`](./assignment-skill-tagging.md) · Merged via [PR #151](https://github.com/AnnieCannons/ac-lms/pull/151)

## Phase 2 — Basic inline rating capture ✅ Done (merged, flag off in production)
- New table `confidence_tracker_ratings` (fully separate from the old `confidence_skills`/`confidence_entries`) storing one rating per student/skill/assignment, with RLS letting a student read/insert only their own rows and staff/instructor/admin read all (anticipating Phase 4).
- In `SubmissionForm.tsx`: before the Submit button, a "How confident do you feel on the following skill(s)? (optional)" card lists the assignment's tagged skills (from Phase 1), each with its own 1–10 rating control. Every rating is entirely optional — no explicit skip action, a student can leave any or all blank — and clicking an already-selected number again unselects it.
- Each of the 10 rating buttons has a hover/focus tooltip with a short description of what that level means, adapted from the original Confidence Tracker's 1–10 scale but reworded to fit any tagged skill (not just coding), since instructors can tag non-technical skills like "Canva" or "Presenting."
- Triggers on **first submission only** — a resubmission (e.g. after "needs revision") does not re-show the prompt. A rating is only written to the database on actual Submit, never on a Draft save; entered-but-unsubmitted ratings persist via `sessionStorage` across in-app navigation (but not a closed tab).
- Visible (read-only in effect) in Student Preview and Observer mode, so instructors/staff see the same accurate prompt a student would — but neither can ever trigger a save, since neither has a working Submit action for a never-yet-submitted assignment.
- If the assignment submission succeeds but the rating save fails, the student sees a separate, non-blocking banner making clear the rating (not the assignment) failed to save.
- No goal/target-date/study-plan logic yet — every skill just gets a plain rating at this stage.
- Spec: [`_specs/confidence-skill-rating-capture.md`](../_specs/confidence-skill-rating-capture.md) · Plan: [`_plans/confidence-skill-rating-capture.md`](./confidence-skill-rating-capture.md) · Merged via [PR #153](https://github.com/AnnieCannons/ac-lms/pull/153)
- **Testable on its own**: submit a tagged assignment, rate or leave blank each skill, confirm saved correctly; confirm a resubmission doesn't re-trigger the prompt. Verified live end-to-end against a real course/assignment (including the multi-skill layout) as of 2026-09-23.

## Phase 3 — New-skill goal & study plan ✅ Done (merged)
- Goal-setting eligibility is decoupled from the "New" tag: a "New" badge marks a skill's first-ever rating, but the option to set a goal persists on any later occasion (new or existing) as long as no goal has been captured yet — skipping it once doesn't forfeit the chance.
- Setting a goal (auto-suggested at current rating + 2, editable, must be at least current + 1, capped at 10) makes a target date (auto-suggested 1 week out, editable, must be a future date — no upper bound) and a study-plan pick (fixed list, multi-select — a student may choose more than one, e.g. flashcards AND TA help; see Open Questions below) required alongside it; leaving the goal blank skips all three. Once a goal is captured for a skill, it's permanent.
- **Mastery & reactivation** (new decision, spec'd during Phase 3): if a skill's rating is already 10 (max), no numeric goal fits — instead the goal section shows "You're at the top of the scale! You're now maintaining this rating," purely informational (no target date/study plan/Skip needed). The system tracks, per student/skill, how many times a rating of 10 has been recorded; once that happens twice, the skill is "mastered" and stops appearing on any assignment for that student. A mastered skill can only come back via a "reactivate" control on the **Phase 4** trend page (see below) — reactivating resets the count and restarts the same rate/goal flow as if new again. Phase 3 has no reactivation UI of its own; this is an accepted gap until Phase 4 ships.
- The Confidence Check card is its own section on the submission page, separate from Turn In, still positioned before the Submit button; each tagged skill renders in its own bordered box for visual clarity.
- Spec: [`_specs/confidence-new-skill-goal.md`](../_specs/confidence-new-skill-goal.md) · Plan: [`_plans/confidence-new-skill-goal.md`](./confidence-new-skill-goal.md) · Merged via [PR #157](https://github.com/AnnieCannons/ac-lms/pull/157)
- **Testable on its own**: rate a never-before-seen skill, confirm the "New" tag, goal auto-suggestion, and required target date/study plan; skip the goal and confirm it's offered again on a later assignment; rate a skill 10 twice across two assignments and confirm it's excluded from a third. Verified live end-to-end against real course data as of 2026-09-28.

## Phase 4 — Trend pages (student-facing + instructor/staff-facing)
- New student-facing page (separate from the old `/student/confidence`) showing this feature's ratings, goals, target dates, and chosen study plans over time.
- New instructor/staff-facing trend page showing each student's ratings individually as well as overall class ratings.
- **New scope item (decided during Phase 3):** the student-facing page must include a "reactivate" control for any skill the student has mastered (rated 10 at least twice, per Phase 3), letting them bring a mastered skill back onto future assignments if they feel their confidence on it has dropped. Reactivating resets that skill's mastery count and restarts the rate/goal flow as if it were new again.
- Doubles as the destination for catching up on anything skipped in later phases (incremental "what helped" or goal-met "what helped").
- **Decided while spec'ing Phase 4** (see [`_specs/confidence-trend-pages.md`](../_specs/confidence-trend-pages.md)):
  - Student page shows all courses together, with a chart breakpoint where each new course's ratings begin; mastery and reactivation are also marked on the chart.
  - Goals and mastery are kept as history, never overwritten: reactivating keeps the earlier goal and the original mastery date, and the new rating/goal continues the same skill's history.
  - Setting a *new* goal after meeting the current one belongs to Phase 6; Phase 4 only builds the goal history it will append to.
  - Instructor page: class overview (average, median, distribution of each student's latest rating, plus "x students rated") for the course's tagged skills and currently active students only, matching the gradebook. Per-student drill-in also shows that student's earlier-course ratings of the same skill as read-only context. TAs excluded; reactivation is student-only.
  - The old Confidence Tracker pages stay in place; each just gains a link to its new counterpart (old student page → new student page, old instructor page → new instructor trend page). Instructors may see a student's earlier-course ratings of a shared skill even for courses they don't teach.
- Spec: [`_specs/confidence-trend-pages.md`](../_specs/confidence-trend-pages.md) · Plan: [`_plans/confidence-trend-pages.md`](./confidence-trend-pages.md) (planned, not yet implemented)
- Surfacing an assignment's confidence ratings on the grading page is **out of scope** for Phase 4 (decided).
- **Follow-up to remember, after Phase 4 ships:** retire the old Confidence Tracker pages (`/student/confidence`, old instructor confidence page) without deleting any data students saved there — decide then whether to archive, export, or keep a read-only view.
- **Testable on its own**: once Phases 2–3 have real data, confirm both pages render correctly.

## Phase 5 — Incremental kudos
- Compare a new rating to the student's most recent prior rating for that skill; on any increase (even +1), show a mini kudos.
- Optional, skippable "what helped" prompt (fixed options + "Other" write-in — see Open Questions below, now decided) — answer or skip logged to the trend page.

## Phase 6 — Goal-met celebration + reminder
- Detect when a rating meets or exceeds the student's goal for that skill.
- Post-submit banner asks "what helped" — answering it is the intended eventual outcome, but a student can "skip for now."
- If skipped: surfaced as an actionable follow-up on the trend page (Phase 4), plus a reminder via the existing `notifications`/`NotificationBell` system.

## Phase 7 — Personal pattern insights
- **Depends on Phase 5/6 having real data** — this phase can't produce anything meaningful until a student has several "what helped" answers logged over time; it can't be built alongside or before Phase 4, since that data doesn't exist yet at that point in the sequence.
- Adds a new section to Phase 4's student trend page (not a new page) surfacing a student's own patterns: aggregates their "what helped" answers across every skill they've rated, grouped by method (e.g. flashcards, TA help, outside tutorials), showing how often each was cited and the average confidence increase associated with it.
- Framed descriptively, not as a causal claim (e.g. "Patterns you've noticed," not "proven to work") — consistent with this app's non-prescriptive tone elsewhere (e.g. "Needs Revision is not a failure").
- Should only appear once a minimum number of "what helped" answers exist, to avoid a misleading pattern drawn from too little data.
- **Not yet spec'd** — exact minimum-data threshold and the chart/list presentation still to be decided.

## Open questions blocking future phases
- **Study-plan options** (blocks Phase 3): fixed list of choices + "Other" write-in — not yet defined.
  - **Answer:** picked once, when rating a new skill for the first time — "How do you plan to work on this?"
    1. Practice on my own (exercises, coding challenges, repetition)
    2. Review the lesson materials again
    3. Get help from a TA or instructor
    4. Watch outside tutorials or videos
    5. Study flashcards
    6. Review class notes
    7. Other (write-in)
- **"What helped" options** (blocks Phase 5): fixed list of choices + "Other" write-in — not yet defined.
  - **Answer:** asked when a rating goes up or a goal is met — deliberately mirrors the study-plan list (same categories, past tense) so Phase 4's trend page can connect "you planned X" to "X is also what helped," plus one extra option that doesn't fit a plan chosen in advance:
    1. Practicing on my own
    2. Reviewing the lesson materials
    3. Getting help from a TA or instructor
    4. Outside tutorials or videos
    5. Studying flashcards
    6. Reviewing class notes
    7. Just needed more time and practice
    8. Other (write-in)

## Suggested next step
Both option lists are decided, Phase 2 is merged into `main`, and Phase 3 has a PR open (gated behind the feature flag below, so production still shows only Phase 1 either way). Once Phase 3 merges, Phase 5 is unblocked (its "what helped" list is already decided) and Phase 4 can begin (needs Phases 2–3's real data to render against) — next: run `/spec` for whichever of Phase 4 or Phase 5 is picked, branching off `main` once Phase 3 is merged.

## Rollout strategy: incremental merges behind a feature flag
Each phase merges into `main` as soon as it's done, rather than holding everything on one branch until the whole feature is finished — this keeps diffs small and reviewable and keeps the branch from drifting out of sync with the rest of the app. To avoid exposing an unfinished experience to students in the meantime, everything **from Phase 2 onward** is gated behind a single feature flag (a server-only env var, checked once where the student assignment page decides whether to fetch/pass real tagged skills — `confidenceSkills.length === 0` already means "show nothing," so most of the UI needs no flag-awareness of its own). Phase 1's instructor-facing tagging field is explicitly **not** gated — it stays live in production throughout, since tagging alone has no student-facing effect. The flag flips on once Phase 6 ships, so students see the complete, coherent experience all at once rather than a partial rollout. Phase 4's trend pages and Phase 6's notifications are new surfaces outside the gated submission-flow code path, so each will need its own explicit check against the same flag when built.
