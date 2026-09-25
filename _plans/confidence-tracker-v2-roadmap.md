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

## Phase 3 — New-skill goal & study plan
- Detect new vs. existing skill per student: "new" = no prior rating exists for that skill; "existing" = rated before (possibly via a different assignment tagged with the same skill).
- New-skill path expands inline to also capture: a goal (auto-suggested at current rating + 2, editable), a target date (auto-suggested 1 week out, editable), and a study-plan pick from a fixed list (see Open Questions below — now decided).

## Phase 4 — Trend pages (student-facing + instructor/staff-facing)
- New student-facing page (separate from the old `/student/confidence`) showing this feature's ratings, goals, target dates, and chosen study plans over time.
- New instructor/staff-facing trend page showing each student's ratings individually as well as overall class ratings.
- Doubles as the destination for catching up on anything skipped in later phases (incremental "what helped" or goal-met "what helped").
- **Idea to revisit, not yet decided**: also surface an assignment's confidence ratings directly on the grading page when an instructor opens that assignment to grade it.
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
Both option lists are decided, and Phase 2 is merged into `main` (gated behind the feature flag below, so production still shows only Phase 1). Phases 3 and 5 are unblocked — next: run `/spec` for Phase 3, branching normally off `main` rather than off the old Phase 2 branch, since it's already merged.

## Rollout strategy: incremental merges behind a feature flag
Each phase merges into `main` as soon as it's done, rather than holding everything on one branch until the whole feature is finished — this keeps diffs small and reviewable and keeps the branch from drifting out of sync with the rest of the app. To avoid exposing an unfinished experience to students in the meantime, everything **from Phase 2 onward** is gated behind a single feature flag (a server-only env var, checked once where the student assignment page decides whether to fetch/pass real tagged skills — `confidenceSkills.length === 0` already means "show nothing," so most of the UI needs no flag-awareness of its own). Phase 1's instructor-facing tagging field is explicitly **not** gated — it stays live in production throughout, since tagging alone has no student-facing effect. The flag flips on once Phase 6 ships, so students see the complete, coherent experience all at once rather than a partial rollout. Phase 4's trend pages and Phase 6's notifications are new surfaces outside the gated submission-flow code path, so each will need its own explicit check against the same flag when built.
