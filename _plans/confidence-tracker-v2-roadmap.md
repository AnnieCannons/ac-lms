# Confidence Tracker v2 — Phased Roadmap

## Context
This is a new, self-contained feature that prompts students to rate their confidence on skills right after submitting an assignment, tracks how that confidence changes over time, and celebrates progress. It's built as a phased rollout — each phase ships and is verifiable on its own before the next begins.

It's deliberately kept separate from two unrelated, pre-existing systems that also involve the word "skill":
- **`confidence_skills`/`confidence_entries`** — the original Confidence Tracker, a per-student free-text list students maintain themselves (`/student/confidence`, `/instructor/courses/[id]/confidence`). Untouched by this initiative.
- **`assignments.skill_tags`/`modules.skill_tags`** — powers the unrelated "Level Up Your Skills" student browsing/filtering feature. Untouched by this initiative.

New tables/UI use the `confidence_tracker_*` naming to avoid colliding with either.

## Open items at a glance
One place for everything still open: what is unfinished, what is waiting to be checked by hand, ideas for later, and follow-ups. It only points to the phases below; the full detail and decisions stay in each phase section, and nothing there was removed.

### Where each phase stands
| Phase | What it is | Status | Still open |
|---|---|---|---|
| [1](#phase-1--skill-tagging-foundation--done-merged) | Skill tagging | Done, merged ([#151](https://github.com/AnnieCannons/ac-lms/pull/151)); live (not behind the flag) | nothing |
| [2](#phase-2--basic-inline-rating-capture--done-merged-flag-off-in-production) | Inline rating capture | Done, merged ([#153](https://github.com/AnnieCannons/ac-lms/pull/153)) | nothing |
| [3](#phase-3--new-skill-goal--study-plan--done-merged) | New-skill goal and study plan | Done, merged ([#157](https://github.com/AnnieCannons/ac-lms/pull/157)) | nothing |
| [4](#phase-4--trend-pages-student-facing--instructorstaff-facing--done-merged) | Trend pages and reactivate | Done, merged ([#158](https://github.com/AnnieCannons/ac-lms/pull/158)) | one hand check |
| [5](#phase-5--incremental-kudos--done-merged-flag-off-in-production) | Incremental kudos | Done, merged ([#161](https://github.com/AnnieCannons/ac-lms/pull/161)) | hand checks |
| [6](#phase-6--goal-met-celebration--reminder--done-merged-flag-off-in-production) | Goal-met celebration and reminder | Done, merged ([#162](https://github.com/AnnieCannons/ac-lms/pull/162)) | hand checks |
| [7](#phase-7--personal-pattern-insights--done-merged-flag-off-in-production) | Personal pattern insights | Done, merged ([#164](https://github.com/AnnieCannons/ac-lms/pull/164)) | hand checks |
| [8](#phase-8--instructor-and-staff-view-of-patterns--done-merged-flag-off-in-production) | Instructor and staff view of patterns | Done, merged ([#165](https://github.com/AnnieCannons/ac-lms/pull/165)); flag off in production | hand checks |

Everything from Phase 2 on is behind `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED`, which is **off in production** and stays off until every phase is complete. Never turn it on without asking first.

### Next up
- [ ] **Phase 8:** do the hand checks listed under [Not yet checked by hand](#not-yet-checked-by-hand) (flag-off, a TA and a student being blocked, high contrast, screen-reader use, and the student's own Patterns tab).
- [ ] Tick each check off here and in its phase section as it is done, and refresh [Suggested next step](#suggested-next-step).

### Not yet checked by hand
Code and unit tests cover most of these; they have just not been looked at live.
- **Phase 4:** the instructor page with a real TA login and a real student login (the TA redirect is covered by code and follows the Readiness page pattern).
- **Phase 5:** dark mode, high contrast, mobile width, screen-reader announcement, flag-off and Student Preview (unit tests cover flag-off and Student Preview).
- **Phase 6:** flag-off behavior, dark and high-contrast visuals, keyboard and screen-reader use, the "New" badge fix on a real reactivated skill, and the bell's limit of the latest 30 notifications.
- **Phase 7:** `npm run build`, high-contrast mode, screen-reader and keyboard use, flag-off and the instructor view, saving an answer from the dialog live, and the zero-answer and 50-skill cases.
- **Phase 8:** flag-off (the page 404s); a TA and a student being blocked from the page (needs those logins); high contrast; screen-reader use; the student's own Patterns tab after the shared component changed (the skill tags now run at full card width on phones, and ids are unique); the "Nothing logged yet" note on a student with ratings but no answers (unit-tested only); and the Patterns tab and per-student patterns at tablet width.

### Before the flag goes on (pre-launch)
Full detail, with the exact SQL, is in [the checklist](#before-flipping-the-flag-on-in-production--checklist) at the end of this file. In short:
- [ ] Delete the Phase 4 demo skills (`ZZ P4 Browser …`) and the Phase 6 test skills (`ZZ P6 …`). Deleting a skill cascades to its ratings, progress, history and tags.
- [ ] Remove or review the test rows the skill delete does not reach: test submissions and their history entries, checklist ticks, the test student's goal outcomes and bell notifications, and the goal and mastery changes made to the demo skills.
- [ ] Apply every confidence-tracker migration by hand in the target Supabase project (the three named in the checklist; the last one must be in place before the bell is used anywhere).
- [ ] Confirm the flag is unset or not `true` in the production environment until all of the above is done, then ask before turning it on.
- [ ] Do the "Not yet checked by hand" items above.

### Ideas for later and decided out of scope for MVP
- **Remove the visible "All ratings (N)" row** from the skill cards while keeping the ratings accessible. A screen-reader-only list plus a richer chart label was tried and reverted; the trade-offs are written down. → [Phase 8](#phase-8--instructor-and-staff-view-of-patterns--done-merged-flag-off-in-production)
  - Related, and part of the same decision: keyboard users can already step through the chart's points (tab onto the chart, then the arrow keys show each rating's assignment and value in the tooltip; checked live). But the chart sits inside a wrapper marked as an image, so a screen reader most likely does not announce what the arrows land on (not tested with a screen reader). Making that work (so the chart itself is the accessible route) is one way the list could become less essential.
- **Limit how many skills can be tagged to one assignment?** Open question; today there is no limit, and each tagged skill adds a rating box to the submission form. → [Phase 1](#phase-1--skill-tagging-foundation--done-merged)
- **Add a third section to the student trend page** for skills that are growing, skills that have reached 10, and mastered skills (for example, got a 10 maybe three times in a row). Today the page has two sections, working on and mastered, and a skill is mastered after two ratings of 10 (Phase 3). → [Phase 4](#phase-4--trend-pages-student-facing--instructorstaff-facing--done-merged)
- **Patterns tab: how to display "Other" methods.** Today the student's own write-ins and "Other" text all fold into a single "Other" and the text is never shown. Decide whether and how to show more than that. → [Phase 7](#phase-7--personal-pattern-insights--done-merged-flag-off-in-production)
- **Bring existing data from the old Confidence Tracker into the new one, and decide how to display it.** Related to retiring the old pages under Follow-ups below. → [Phase 4](#phase-4--trend-pages-student-facing--instructorstaff-facing--done-merged)
- **Improve the overall UX and design** of the feature, across the student and instructor pages and the submission flow.

**Decided out of scope for MVP** (not planned):
- **"Needs attention" count** on the instructor Class overview cards, for example "4 students rated 4 or below", since a central number can hide a few students who are struggling. The cutoff (4 or below?) is undecided. Kept separate from Phase 8. → [Phase 4](#phase-4--trend-pages-student-facing--instructorstaff-facing--done-merged), [Phase 8](#phase-8--instructor-and-staff-view-of-patterns--done-merged-flag-off-in-production)
- **Rethink the instructor By-student layout** around what instructors actually scan for (who is struggling, who is stuck, who moved recently, who has no data); talk to instructors first. Phase 8 already added sorting by recency or rating, collapsible parts and skill cards, and a multi-select skill filter to that tab, so check what is still missing before starting. → [Phase 4](#phase-4--trend-pages-student-facing--instructorstaff-facing--done-merged)
- **Showing instructors the rated skills for each assignment when they grade.** Out of scope for the MVP (decided in Phase 4). It remains an open question whether to add it later:
  - Good: an early check on the learning gaps the ratings might reveal, before grading is finished.
  - Bad: students might feel a certain way knowing their confidence level will be seen when the instructor grades.
  → [Phase 4](#phase-4--trend-pages-student-facing--instructorstaff-facing--done-merged)
- Letting students export or print their history (Phase 4 spec).
- TAs seeing any of this feature's data: they are excluded throughout.

### Follow-ups to remember
- **Retire the old Confidence Tracker pages** (`/student/confidence` and the old instructor confidence page) without deleting any data students saved there. Decide then whether to archive, export, or keep a read-only view. → [Phase 4](#phase-4--trend-pages-student-facing--instructorstaff-facing--done-merged)

### Already done (kept for reference)
- **Let a student set a goal from the "My Skill Confidence" page** if they skipped it at submission was an idea in Phase 4. It was built in Phase 6 as the "Set a goal" control.

### Standing notes
- **The flag stays off** until all phases are done, and it is never turned on without asking.
- **Local development and production share one Supabase database.** Anything created while testing is visible to production, so test data is tracked and cleaned up deliberately. Ask before writing or deleting shared data.
- **Phase 1 tagging is not behind the flag:** instructors see skill tags in the Assignment Editor today. Students see nothing while the flag is off.
- **Migrations are applied by hand** in the Supabase Dashboard; keep them idempotent.
- **Separate from the old systems:** the original Confidence Tracker (`confidence_skills` / `confidence_entries`) and "Level Up Your Skills" (`skill_tags`) are untouched by this initiative.

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
- **Mastery & reactivation** (new decision, spec'd during Phase 3): if a skill's rating is already 10 (max), no numeric goal fits — instead the goal section shows "You're at the top of the scale! You're now maintaining this rating," purely informational (no target date/study plan/Skip needed). The system tracks, per student/skill, how many times a rating of 10 has been recorded; once that happens twice, the skill is "mastered" and stops appearing on any assignment for that student. A mastered skill can only come back via a "reactivate" control on the **Phase 4** trend page (see below) — reactivating resets the count and restarts the same rate/goal flow as if new again (without the "New" badge, which stays for a skill never rated before). Phase 3 has no reactivation UI of its own; this is an accepted gap until Phase 4 ships.
- The Confidence Check card is its own section on the submission page, separate from Turn In, still positioned before the Submit button; each tagged skill renders in its own bordered box for visual clarity.
- Spec: [`_specs/confidence-new-skill-goal.md`](../_specs/confidence-new-skill-goal.md) · Plan: [`_plans/confidence-new-skill-goal.md`](./confidence-new-skill-goal.md) · Merged via [PR #157](https://github.com/AnnieCannons/ac-lms/pull/157)
- **Testable on its own**: rate a never-before-seen skill, confirm the "New" tag, goal auto-suggestion, and required target date/study plan; skip the goal and confirm it's offered again on a later assignment; rate a skill 10 twice across two assignments and confirm it's excluded from a third. Verified live end-to-end against real course data as of 2026-09-28.

## Phase 4 — Trend pages (student-facing + instructor/staff-facing) ✅ Done (merged)
- New student-facing page (separate from the old `/student/confidence`) showing this feature's ratings, goals, target dates, and chosen study plans over time.
- New instructor/staff-facing trend page showing each student's ratings individually as well as overall class ratings.
- **New scope item (decided during Phase 3):** the student-facing page must include a "reactivate" control for any skill the student has mastered (rated 10 at least twice, per Phase 3), letting them bring a mastered skill back onto future assignments if they feel their confidence on it has dropped. Reactivating resets that skill's mastery count and restarts the rate/goal flow as if it were new again (without the "New" badge, which stays for a skill never rated before).
- Doubles as the destination for catching up on anything skipped in later phases (incremental "what helped" or goal-met "what helped").
- **Decided while spec'ing Phase 4** (see [`_specs/confidence-trend-pages.md`](../_specs/confidence-trend-pages.md)):
  - Student page shows all courses together, with a chart breakpoint where each new course's ratings begin; mastery and reactivation are also marked on the chart.
  - Goals and mastery are kept as history, never overwritten: reactivating keeps the earlier goal and the original mastery date, and the new rating/goal continues the same skill's history.
  - Setting a *new* goal after meeting the current one belongs to Phase 6; Phase 4 only builds the goal history it will append to.
  - Instructor page: class overview (average, median, distribution of each student's latest rating, plus "x students rated") for the course's tagged skills and currently active students only, matching the gradebook. Per-student drill-in also shows that student's earlier-course ratings of the same skill as read-only context. TAs excluded; reactivation is student-only.
  - The old Confidence Tracker pages stay in place; each just gains a link to its new counterpart (old student page → new student page, old instructor page → new instructor trend page). Instructors may see a student's earlier-course ratings of a shared skill even for courses they don't teach.
- Spec: [`_specs/confidence-trend-pages.md`](../_specs/confidence-trend-pages.md) · Plan: [`_plans/confidence-trend-pages.md`](./confidence-trend-pages.md) · Merged via [PR #158](https://github.com/AnnieCannons/ac-lms/pull/158); as built, the student page has two titled sections (working on / mastered) with searchable multi-select skill pickers, and the instructor page has Class overview and By student tabs
- Surfacing an assignment's confidence ratings on the grading page is **out of scope** for Phase 4 (decided).
- **Idea for later (not in Phase 4):** let a student set a goal for a skill directly from the "My Skill Confidence" page if they skipped it when submitting the assignment. Today a skill without a goal just shows "No goal set for this skill yet." in its Current goal panel; that panel is the natural spot for a "Set a goal" action (target rating, target date, study methods — same rules as at submission). It pairs naturally with Phase 6's "set a new goal after meeting one", since both need a goal-setting control on this page and both append to the goal history.
- **Idea for later (not in Phase 4):** on the instructor Class overview cards, add a "needs attention" count alongside the average and median — for example "4 students rated 4 or below" — since a central number can hide a few students who are struggling. Decided in the meantime: keep median and average, skip mode (the distribution bars already show the tallest bar and any split in the class). The cutoff (4 or below?) is still to be decided.
- **Idea for later (not in Phase 4):** revisit the instructor Skill Confidence page and think about how to present the data in whatever way instructors will find most helpful — especially the "By student" tab, which today is an alphabetical list of collapsed rows that each expand into full per-skill charts. Worth talking to instructors about what they actually scan for (who is struggling, who is stuck, who moved recently, who has no data) and whether a summary line per student, highlighting or ordering students who need attention, or a compact grid of students by skills would serve them better than opening each row. Related ideas already noted above: the "needs attention" count on the Class overview.
- **Follow-up to remember, after Phase 4 ships:** retire the old Confidence Tracker pages (`/student/confidence`, old instructor confidence page) without deleting any data students saved there — decide then whether to archive, export, or keep a read-only view.
- **Testable on its own**: once Phases 2–3 have real data, confirm both pages render correctly. Verified live as of 2026-09-29 against real course data: student page (charts, course dividers, goal history, mastered/reactivate flow, phone width), instructor page (class overview stats, per-student drill-in with earlier-course context, filters, sorting, no reactivate control), and flag-off behavior (both pages 404, no links). Not verified with a real TA or student login on the instructor page — the TA redirect is covered by code and follows the Readiness page pattern.

## Phase 5 — Incremental kudos ✅ Done (merged, flag off in production)
- Spec: [`_specs/confidence-incremental-kudos.md`](../_specs/confidence-incremental-kudos.md) · Plan: [`_plans/confidence-incremental-kudos.md`](./confidence-incremental-kudos.md) · Merged via [PR #161](https://github.com/AnnieCannons/ac-lms/pull/161)
- Compare a new rating to the student's most recent prior rating for that skill; on any increase (even +1), show a mini kudos.
- Kudos only, with the change shown (e.g. "from 4 to 6"); it asks nothing and stores nothing. No kudos on a skill's first rating, including the first rating after a reactivation.
- **Changed while spec'ing:** the optional "what helped" prompt was moved out of this phase to Phase 6 — it is asked only when a goal is met, not on every increase.
- As built: computed at save time inside `saveConfidenceRatings` (returns `{ error, kudos }`), nothing stored, no migration; the dismissible card sits beside "Turned in".
- **Testable on its own**: verified live — a skill rated 5 then 7 showed kudos ("from 5 to 7"), equal and lower ratings showed none, and it does not return after dismissing and reloading. Not checked live: dark mode, high contrast, mobile width, screen-reader announcement, flag-off and Student Preview (unit tests cover flag-off and Student Preview).

## Phase 6 — Goal-met celebration + reminder ✅ Done (merged, flag off in production)
- Spec: [`_specs/confidence-goal-met.md`](../_specs/confidence-goal-met.md) · Plan: [`_plans/confidence-goal-met.md`](./confidence-goal-met.md) · Merged via [PR #162](https://github.com/AnnieCannons/ac-lms/pull/162)
- As built: reached goals are recorded once in the new `confidence_tracker_goal_outcomes` table (keeps `goal_history` append-only); the celebration, mastery celebration, "what helped" question and next-goal step come from `saveConfidenceRatings`; "what helped" is add-only, with "Other" capped at 200 characters; My Skill Confidence gains a "What helped?" summary, per-skill follow-ups and a "Set a goal" control (one open goal per skill, enforced server-side); the reminder is created in the bell the moment a goal is reached (no scheduled job), answering marks it read, and a new Clear option on every notification hides it via `notifications.cleared_at`. Student View can rate and set goals but can't save; the instructor view is read-only.
- Also fixed: the old `target_date > CURRENT_DATE` database rule made every later rating of a skill fail once its goal's date passed; the migration dropped it. The "New" badge now shows only for a never-rated skill (not a reactivated one).
- **Not verified by hand yet:** flag-off behavior, dark and high-contrast visuals, keyboard and screen-reader use, the "New" badge fix on a real reactivated skill, and the bell's limit of the latest 30 notifications.
- Original scope and decisions:
- Detect when a rating meets or exceeds the student's goal for that skill, and celebrate reaching mastery (the second 10) with its own message (no "what helped" for mastery).
- Post-submit banner asks "what helped" — answering it is the intended eventual outcome, but a student can "skip for now." This is now the **only** place "what helped" is asked (moved here from Phase 5). Options are in Open Questions below. Decisions carried over from the Phase 5 spec (see its Open Questions): multi-select; an explicit skip and walking away are treated the same ("Not answered yet," answerable later); answers are add-only; the student's own study-plan "Other" write-in for that skill is offered as an extra choice; "Other" text follows the study plan's length/validation; instructors and staff see answers read-only on the per-student view; no catch-up for data from before it ships.
- If skipped: surfaced as an actionable follow-up on the trend page (Phase 4), plus a reminder in the existing `notifications`/`NotificationBell` system, created as soon as the goal is reached; answering marks it read, and it stays until the student clears it or clicks it (bell only, not the digest email; clearing only hides it from notifications, the follow-up stays on the trend page).

## Phase 7 — Personal pattern insights ✅ Done (merged, flag off in production)
- **Depends on Phase 6 having real data** (Phase 5 no longer records "what helped") — this phase can't produce anything meaningful until a student has several "what helped" answers logged over time (one per goal met); it can't be built alongside or before Phase 4, since that data doesn't exist yet at that point in the sequence.
- Adds a new section to Phase 4's student trend page (not a new page) surfacing a student's own patterns: aggregates their "what helped" answers across every skill they've rated, grouped by method (e.g. flashcards, TA help, outside tutorials), showing how many times each was named and for which skills.
- **Changed while spec'ing:** no average confidence increase is calculated (the count of times a method was named is the measure), and there is no minimum number of answers — the section shows results from the first answer and updates as the student answers more; with none yet it shows a gentle note.
- Framed descriptively, not as a causal claim (e.g. "Patterns you've noticed," not "proven to work") — consistent with this app's non-prescriptive tone elsewhere (e.g. "Needs Revision is not a failure").
- Spec: [`_specs/confidence-pattern-insights.md`](../_specs/confidence-pattern-insights.md) · Plan: [`_plans/confidence-pattern-insights.md`](./confidence-pattern-insights.md) · Merged via [PR #164](https://github.com/AnnieCannons/ac-lms/pull/164)
- As built: My Skill Confidence has two tabs, Skills (default) and Patterns ("What tends to help you"). For each method it shows a count tile ("Helped N times") and the skills it helped on as tags (collapsed to one line with a "+N more" tag, measured in the browser and re-measured on resize; "Show fewer" when open). Write-ins and "Other" fold into one "Other". No migration, no new query, nothing stored; the grouping logic is in `src/lib/confidence-patterns.ts`. The "What helped?" follow-up above the tabs became a one-line banner whose "Log what helped" button opens a dialog listing each waiting goal (the `#what-helped` anchor is kept for the bell link).
- Decided: no drill-down (per-skill counts instead); a bar line was tried and replaced by count tiles; student-only (staff view is Phase 8).
- **Not verified by hand yet:** `npm run build`, high-contrast mode, screen-reader and keyboard use, flag-off and the instructor view, saving an answer from the dialog live, and the zero-answer and 50-skill cases.

## Phase 8 — Instructor and staff view of patterns ✅ Done (merged, flag off in production)
- **Depends on Phase 7.** Lets admins, instructors and staff see "what helped" patterns, which Phase 7 deliberately shows only to the student. Spec: [`_specs/confidence-instructor-patterns.md`](../_specs/confidence-instructor-patterns.md) (branch `claude/feature/confidence-instructor-patterns`) — Plan: [`_plans/confidence-instructor-patterns.md`](./confidence-instructor-patterns.md) — all open questions answered; merged via [PR #165](https://github.com/AnnieCannons/ac-lms/pull/165), not yet verified by hand (see below).
- **Decided while spec'ing:**
  - Both views are included: per-student patterns in a student's expanded By student view, and a class-level view on a new third tab of the instructor Skill Confidence page (the Class overview stays focused on ratings).
  - Both are limited to skills tagged on this course; the class-level view counts only currently active students (matching the gradebook), never names or links individual students, never shows free text, and ignores the student filter (narrowed only by skill).
  - No minimum number of answers, and no small-group protection; it shows how many students and answered goals it is based on, but not a "not yet logged" count. No drill-down.
  - Same access rules as the rest of this feature (admin, instructor and staff; TAs excluded), same descriptive, non-causal framing, same flag; read-only, nothing stored.
  - The "needs attention" count stays a separate later idea.
- As built: a third **Patterns** tab on the instructor Skill Confidence page (class-level counts, narrowed only by the skill filter, never naming a student) and, inside each expanded student row, two collapsible parts, "What tends to help this student" and "Skills", both closed to begin with; each skill card is closed too, showing only its name and latest rating. The page's Sort gained "Most recent first" (the default) and "Least recent first" and now also orders the skill cards inside a student's row; the Skills filter takes several skills (clicking a chip removes it); the overview shows three cards per row when there is room; and the tab row, tags and card text are fitted to phone widths. No migration, no new query, nothing stored. The logic is `computeClassPatterns` in `src/lib/confidence-patterns.ts`.
- **Not verified by hand yet:** see "Phase 8" under [Not yet checked by hand](#not-yet-checked-by-hand).
- **Idea for later (not in Phase 8):** consider removing the visible "All ratings (N)" row from the skill cards (the instructor By-student cards, and possibly the student's own cards) while keeping the ratings accessible, since the chart already shows the same ratings. The row is the non-visual equivalent of the chart that the Phase 4 spec requires, so it can only go if that is replaced. Tried and reverted during Phase 8 (kept the visible row for now): on the instructor cards, make the list screen-reader-only (`sr-only`) and add each rating's assignment, course and an "earlier course" marker to the chart's `aria-label`. It worked: the hidden list and label showed up in the accessibility tree for all 18 skills in the test course. Trade-offs to weigh before doing it: a sighted instructor then can't read each rating's assignment name, full date and course in plain text without hovering dots (the chart tooltip shows only the assignment name and value), and the label gets very long for skills with many ratings (31 in the test data). Also noted: the chart is already keyboard-steppable (arrow keys move through the points), but its image wrapper probably hides that from screen readers. Not recommended to remove it outright, since screen-reader users would lose the individual ratings.

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
- **"What helped" options** (blocks Phase 6): fixed list of choices + "Other" write-in — not yet defined.
  - **Answer:** asked only when a goal is met (Phase 6; mastery is celebrated but not asked about) — deliberately mirrors the study-plan list (same categories, past tense) so Phase 4's trend page can connect "you planned X" to "X is also what helped." The earlier extra option "Just needed more time and practice" was removed in Phase 6:
    1. Practicing on my own
    2. Reviewing the lesson materials
    3. Getting help from a TA or instructor
    4. Outside tutorials or videos
    5. Studying flashcards
    6. Reviewing class notes
    7. Other (write-in)

## Suggested next step
Phases 1–8 are merged into `main` (Phase 8 via [PR #165](https://github.com/AnnieCannons/ac-lms/pull/165)), and everything from Phase 2 onward stays behind `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED`, which is still off in production. Next are the hand checks that Phases 4 to 8 left open, then the pre-launch cleanup. A "needs attention" count on the class overview and a rethink of the By-student layout are out of scope for the MVP. Still open for later: retiring the old Confidence Tracker pages, and the other ideas listed under [Open items at a glance](#open-items-at-a-glance). Don't forget the pre-launch checklist at the end of this file (especially deleting the demo and test data, and the hand checks Phases 6, 7 and 8 left unverified) before the flag is turned on. The full list of open items is in [Open items at a glance](#open-items-at-a-glance) at the top.

## Rollout strategy: incremental merges behind a feature flag
Each phase merges into `main` as soon as it's done, rather than holding everything on one branch until the whole feature is finished — this keeps diffs small and reviewable and keeps the branch from drifting out of sync with the rest of the app. To avoid exposing an unfinished experience to students in the meantime, everything **from Phase 2 onward** is gated behind a single feature flag (a server-only env var, checked once where the student assignment page decides whether to fetch/pass real tagged skills — `confidenceSkills.length === 0` already means "show nothing," so most of the UI needs no flag-awareness of its own). Phase 1's instructor-facing tagging field is explicitly **not** gated — it stays live in production throughout, since tagging alone has no student-facing effect. The flag flips on only once every phase is complete (there may be phases beyond Phase 7), and only after asking, so students see the complete, coherent experience all at once rather than a partial rollout. Phase 4's trend pages and Phase 6's notifications are new surfaces outside the gated submission-flow code path, so each will need its own explicit check against the same flag when built.

### Before flipping the flag on in production — checklist
- **Delete the demo data first.** During Phase 4 verification, temporary skills named `ZZ P4 Browser …` (Class, Goal, Mastered, HTML, JavaScript, Presenting, Figma, Git, Twenty, Thirty) were created in the shared Supabase database — production reads the same data as local development (confirmed 2026-09-29: instructors on the live site can see the demo tags) — tagged on real assignments in the "Intro to Programming (May 2026)" course, with ratings under about 13 real student accounts. They are kept for now because later phases may reuse them. Instructors can see the tags in the Assignment Editor (Phase 1 tagging is not flag-gated) and that is accepted; students see nothing while the flag is off (confirmed in production the same day: no rating prompt). Once the flag is on, a student's first submission of those assignments would show these skills in the rating prompt, so they must be removed before the flip. Deleting a skill in `confidence_tracker_skills` cascades to its ratings, progress, goal history, mastery/reactivation events and assignment tags in one step (e.g. `DELETE FROM confidence_tracker_skills WHERE name LIKE 'ZZ P4 Browser%';`). Confirm afterwards that no `ZZ P4 Browser%` rows remain.
- **Also remove or review the test rows on real course data that the skill delete does not reach.** Deleting the `ZZ P4 Browser%` skills cascades to their ratings, progress, goal history and tags, but not to rows created on real assignments while testing (Phases 3–5 verification, using the student account `zHaniyaStudent`). Look for and remove, or decide to keep: test submissions and their `submission_history` entries (e.g. links like `https://codepen.io/example/pen/kudos-test…`, in "Intro to Programming (May 2026)" — "Personal Operating Manual: CSS edition" among them), and the `student_checklist_progress` ticks made to allow submitting. Left in place, they would look like a real student's submission when the flag goes on.
- **Confirm the flag is off everywhere it should be** (`CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` unset or not `true` in the production environment) until this checklist is done.
- **Apply every confidence-tracker migration by hand** in the target Supabase project, including `20260929000000_confidence_tracker_history.sql`, `20260930000000_confidence_tracker_goal_outcomes.sql` (Phase 6) and `20260930010000_notifications_cleared_and_reminder_simplify.sql` (Phase 6: notification Clear, simplified reminder). The bell reads `notifications.cleared_at`, so the last one must be applied before the feature is used anywhere.
- **Also remove the Phase 6 test data.** `DELETE FROM confidence_tracker_skills WHERE name LIKE 'ZZ P6 %';` (cascades to its ratings, progress, goal history, outcomes and tags), plus the Phase 6 test rows on real data: the test student's goal-reached outcomes and their bell notifications (`notifications` of type `confidence_goal_what_helped` for `zHaniyaStudent`), the tags and goal/mastery changes made to the `ZZ P4 Browser …` skills and their progress rows, and the test submissions and checklist ticks on the assignments used for the live checks (Box model assignment, Annotating web pages, Objects and Arrays Exercise, Ice Cream Order Form, Farmer's market vertical navbar, Week 3 Update your to-do list, Week 3 Blogging AND Code documentation, Week 5 and Week 8 Update your to-do list).
