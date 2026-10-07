# Confidence Tracker v2 — launch runbook

The steps for turning Confidence Tracker v2 on in production, checking it, and turning it off again if needed. It is a checklist to follow on launch day, not a place to record findings; the roadmap ([`confidence-tracker-v2-roadmap.md`](./confidence-tracker-v2-roadmap.md)) stays the record of what was built and checked.

Written 2026-10-07. Nothing in this file has been run. **The flag is never turned on without the owner saying so in that moment** (see Step 6).

## What the flag is

- `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED`, read in `src/lib/feature-flags.ts` as `process.env.CONFIDENCE_TRACKER_V2_RATINGS_ENABLED === 'true'`. Only the exact string `true` is on; unset, `false`, `True`, `1` and anything else are off.
- It is a server-only variable. It must not get a `NEXT_PUBLIC_` prefix.
- It is set **only in Vercel**, as an environment variable on the production project (Project → Settings → Environment Variables). The repo never contains it (`vercel.json` holds only the cron schedules). Local dev has it on in `.env.local`.
- Phase 1 skill tagging in the Assignment Editor is **not** behind the flag; it is already live. Everything from Phase 2 onward is.
- Where it takes effect: the student assignment page (rating prompt), the student and instructor Skill Confidence pages (they return "not found" while it is off), both sidebars' Skill Confidence links, the goal and "what helped" actions, and the Skill Confidence sections of the student and instructor help docs.

## How production deploys

- Automatically through the Vercel GitHub integration. Every merge to `main` creates a Production deployment. There is no Vercel command-line tool on the dev machine, so nothing is deployed by hand from here.
- **Changing an environment variable does not change the live site by itself.** Vercel applies it only to new deployments; the running deployment keeps the value it was built with. After any change to the flag, redeploy: Deployments → the latest Production deployment → ⋯ → Redeploy. A new merge to `main` also works.
- This applies in both directions, turning on and turning off.

## Important: local and production share one database

Local development and production use the same Supabase database. The test data written during testing is therefore already visible to production, and real students would see it the moment the flag is on. That is why the cleanup in Step 3 comes first. Ask before every write or delete on shared data.

## Before you start

- [ ] Coworker testing is finished (due Fri 2026-10-09) and their log has been read; anything they found is fixed, merged and deployed.
- [ ] The one open hand check, a real screen reader, is done or consciously accepted as open.
- [ ] Everything intended for launch is merged to `main`. In particular the branch with the cleanup script (`claude/chore/cleanup-confidence-test-data`, commit `f96745a`) is **not pushed or merged yet**; the script does not exist on `main` until it is.
- [ ] The roadmap's pre-launch checklist ("Before flipping the flag on in production") has been read start to finish, since it holds the exact test-data lists this runbook relies on.

## Step 1 — Confirm the flag is off in production

1. Open Vercel → the production project → Settings → Environment Variables.
2. Find `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED`. It should be missing, or set to anything other than `true`, for the Production environment. Note which it is, and whether Preview or Development have their own value.
3. Check the live site as a student: no rating prompt on an assignment submission, no Skill Confidence link in the student sidebar, and `/student/skill-confidence` shows "not found".

The roadmap records the flag as off as of 2026-09-29. It cannot be read from the repo, so it has to be checked here.

## Step 2 — Apply the migrations in the production database

Migrations are applied by hand: paste each file into the Supabase Dashboard's SQL editor for the project production uses. They are idempotent, so running one that is already applied is safe. Confirm in the dashboard (or by checking the table or column exists) that each is in place:

| File | What needs it |
| --- | --- |
| `20250327000000_confidence_tracker.sql` | The older tracker (untouched by this work) |
| `20260922000000_confidence_tracker_skills.sql` | Skills and assignment tagging (Phase 1, already live) |
| `20260923000000_confidence_tracker_ratings.sql` | Ratings on submission |
| `20260928000000_confidence_tracker_skill_progress.sql` | Current state per student and skill |
| `20260929000000_confidence_tracker_history.sql` | Goal history and events, filled by a trigger |
| `20260930000000_confidence_tracker_goal_outcomes.sql` | "What helped" answers (Phase 6) |
| `20260930010000_notifications_cleared_and_reminder_simplify.sql` | The bell reads `notifications.cleared_at`, so this must be in place before the bell is used anywhere |
| `20261005000000_confidence_tracker_goal_outcomes_standalone.sql` | A return to 10 with no goal can store its answer. Applied by hand to the shared database on 2026-10-05 |

If production is the same Supabase project as local development (the roadmap says it is), most of these are already in place; the point of this step is to confirm that, not to assume it.

## Step 3 — Remove the test data

Run **after** testing ends and **before** the flag goes on. The roadmap's pre-launch checklist has the full lists; the short version:

- The `ZZ` skills (19 at last count, which includes `ZZ Test New Skill`). Deleting a skill cascades to its ratings, progress, history, events, goal outcomes and assignment tags. Use the pattern `ZZ %`, not the older `ZZ P4 Browser%` / `ZZ P6 %` patterns, which miss the newer skill.
- The coworker-testing assignment `ZZ Test Assignment` (`01ccaf8a-c2a2-4941-bd34-ad0771969230`, Intro to Programming (May 2026), Week 11 Thursday). It is published and visible to real students, so it should come out as soon as testing ends.
- The test student's (`zHaniyaStudent`) submissions, submission history and checklist ticks on assignments tagged with a `ZZ` skill, and their bell notifications of type `confidence_goal_what_helped`.
- The test student's own ratings and progress on real skills such as Notion (optional; decide deliberately).

How:

1. Merge the cleanup script to `main`, or run it from its branch.
2. Run it in report mode first. It changes nothing:

   ```bash
   source .env.local && npx ts-node --esm scripts/cleanup-confidence-test-data.ts
   ```

3. Read the report with the owner. Everything it lists should be test data. In particular, it should show no real student's submission, and no rating on a non-`ZZ` skill other than the test student's.
4. Only with the owner's OK, run it for real. It writes a JSON backup first:

   ```bash
   source .env.local && npx ts-node --esm scripts/cleanup-confidence-test-data.ts --execute
   ```

   Add `--include-test-student-ratings` only if the owner wants the test student's non-`ZZ` rows removed too.
5. Run the report again. A second run should find nothing left.
6. By hand: uploaded files for any file submissions it lists (the script does not delete storage files), and any items the coworker's log mentions that the script does not cover.
7. Confirm no `ZZ` rows remain:

   ```sql
   SELECT count(*) FROM confidence_tracker_skills WHERE name ILIKE 'ZZ %';
   ```

   Then look at the Intro to Programming (May 2026) assignments in the Assignment Editor and check that no `ZZ` tag is left on any of them.

## Step 4 — Last check before the switch

- [ ] `main` is the commit you intend to launch, and its latest Production deployment finished successfully in Vercel.
- [ ] Steps 1 to 3 are done and ticked off.
- [ ] The instructors know it is going live today (the instructor help docs gain a Skill Confidence section when the flag is on). Who tells them, and how, is the owner's call.
- [ ] Someone is available for the first hour after the switch to watch for problems and, if needed, turn it off.

## Step 5 — Decide what happens to the old Confidence Tracker link

Decided: the old Confidence Tracker (`/student/confidence`, `confidence_skills` / `confidence_entries`) stays as it is, with no import and no export; it has almost no data. The only open question is what to do with the old navigation link at launch. Settle that before the switch, and write the answer here.

## Step 6 — Turn the flag on (needs the owner's go-ahead)

**Do not do this step without an explicit yes from the owner on the day.** Approval earlier in the project does not carry over.

1. Vercel → the production project → Settings → Environment Variables.
2. Add or edit `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` with the value `true` (lowercase, exactly) for the **Production** environment only. Do not tick Preview or Development unless that is intended.
3. Redeploy: Deployments → the latest Production deployment → ⋯ → Redeploy. Wait for it to finish.

## Step 7 — Check it worked

On the live site, with a staff account in Student View (a `student-view=<courseId>` cookie, set by the Student View button) or a real test student, as appropriate:

1. A student sees the Skill Confidence link, and `/student/skill-confidence` loads instead of "not found".
2. An assignment that has a Confidence Skill tagged shows the rating prompt on a first submission. An assignment with none shows nothing new.
3. The instructor sidebar shows Skill Confidence for a course, and its page loads with the Class overview. TAs do not see it.
4. The Skill Confidence sections appear in the student and instructor help docs.
5. No new errors in the Vercel logs for the first few minutes.
6. Anything saved during this check is real data on the shared database. Prefer checks that only read; if one must write, tell the owner first and add it to a cleanup list.

## Rollback — turning it off

Fast and safe, because the data stays in place.

1. Vercel → Settings → Environment Variables → set `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` to `false`, or delete it, for the Production environment.
2. Redeploy (Deployments → latest Production → ⋯ → Redeploy). **Until the redeploy finishes, the feature is still on.**
3. Check as in Step 1: no rating prompt, no sidebar link, and the Skill Confidence pages return "not found".

What this does not do: it deletes nothing. Ratings, goals and answers students saved while it was on stay in the database and show again if the flag is turned back on. Check whether any bell reminders created while it was on still show; the roadmap does not say. If a data problem (not a display problem) is the reason for rolling back, stop and talk to the owner before touching any rows.

## After launch

- Retire the old Confidence Tracker pages (without deleting anything students saved there).
- The open ideas in the roadmap's "Ideas for later" list: tagging Confidence Skills when creating an assignment, how to display "Other" methods, a cap on skills per assignment.
- Update the roadmap (a separate change, since another branch also edits it): tick off the pre-launch items, and record the old-tracker decision.
