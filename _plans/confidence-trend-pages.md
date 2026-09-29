# Confidence Tracker v2 — Phase 4: Trend Pages + Reactivate

## Context
Phases 2–3 capture per-skill 1–10 ratings, goals, and mastery, but nothing displays them and a mastered skill can never come back. Phase 4 (spec: [`_specs/confidence-trend-pages.md`](../_specs/confidence-trend-pages.md), branch `claude/feature/confidence-trend-pages`) adds a student trend page, an instructor/staff per-course trend page, and a student-only "Reactivate" control. Everything stays behind `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED`.

The hard part is the data model: goals and mastery must be kept as **history** (spec), but Phase 3's `confidence_tracker_skill_progress` is one row per student/skill with single `mastered_at`/`reactivated_at` timestamps and all-or-nothing goal CHECKs. Reactivation must reset that row's *current* state so Phase 3's rating flow works untouched.

## Design decisions
- **Keep `skill_progress` as "current state"; add two append-only history tables**, filled by a **Postgres trigger** on `skill_progress`. Phase 3's write path (`saveConfidenceRatings`) needs zero changes, history is atomic with the state change (Supabase JS has no transactions), and reactivation is a plain guarded `UPDATE`.
- **Reactivation** = one `UPDATE` on the caller's own row `WHERE is_mastered = true`: `is_mastered=false, ten_rating_count=0, is_new_pending=true, reactivated_at=now()`, and clear `goal, goal_is_maintain, target_date, study_plan, study_plan_other` **in the same statement** (required: the `target_date > CURRENT_DATE` CHECK fails any UPDATE that leaves a stale past date). `mastered_at` is left as-is. Phase 3's existing `isNew` / `canSetGoal` logic then treats it as brand new, so no rating-flow changes. Old goals/mastery live on in history.
- **Loaders are not in a `'use server'` file** (that would expose them as endpoints): pure shaping in `src/lib/confidence-trend.ts`, data loaders in `src/lib/confidence-trend-data.ts` (called only from server pages after an access check). Only `reactivateConfidenceSkill` is a server action.
- **Names** (spec left to planning): student route `/student/skill-confidence`, page "My Skill Confidence"; instructor route `/instructor/courses/[id]/skill-confidence`, nav "Skill Confidence" — both clearly distinct from "Confidence Tracker".
- **Chart**: recharts (already used in `ConfidenceTracker.tsx`, `ReadinessWidgets.tsx`). X axis = ordinal rating position (like the old chart), so breakpoints/events are `ReferenceLine x={k+0.5}`; goal is a dashed `ReferenceLine y`. Theme via CSS vars (`var(--color-border)`, `var(--color-muted-text)`, teal-primary), as `ConfidenceTracker.tsx:459-476` does.
- **Reactivate in Student Preview/Observer**: those accounts never write ratings, so they have no mastered row of their own — the action is naturally a no-op for them. Extra explicit guard: reject if `users.role` is admin/instructor/staff, and the UI disables the control for them.

## 1. Migration — `supabase/migrations/20260929000000_confidence_tracker_history.sql`
(Idempotent; follow the CREATE TABLE → indexes → RLS → policies → GRANT shape from `20260928000000_confidence_tracker_skill_progress.sql`.)
- `confidence_tracker_goal_history`: `id, student_id → users, skill_id → confidence_tracker_skills (both CASCADE), goal int, goal_is_maintain bool, target_date date, study_plan text[], study_plan_other text, created_at timestamptz default now()`. Mirror the goal/study-plan CHECKs from skill_progress but **no** future-date CHECK (snapshots are historical).
- `confidence_tracker_skill_events`: `id, student_id, skill_id, event_type text CHECK IN ('mastered','reactivated'), created_at`.
- Indexes on `(student_id, skill_id)` for both.
- RLS: SELECT own rows or `users.role IN ('admin','instructor','staff')` (TAs excluded, same as Phases 1–3); **no** INSERT/UPDATE/DELETE policies (only the trigger writes).
- `SECURITY DEFINER` trigger function (`SET search_path = public`) `AFTER INSERT OR UPDATE` on `skill_progress`:
  - goal snapshot when `(NEW.goal IS NOT NULL OR NEW.goal_is_maintain)` and (INSERT, or goal/goal_is_maintain/target_date/study_plan changed vs OLD);
  - `'mastered'` event when `NEW.is_mastered` and (INSERT or `NOT OLD.is_mastered`), `created_at = COALESCE(NEW.mastered_at, now())`;
  - `'reactivated'` event when UPDATE and `OLD.is_mastered AND NOT NEW.is_mastered`.
- Idempotent backfill from existing `skill_progress` rows (goal snapshots, mastered events) with `WHERE NOT EXISTS` guards. Timestamps are approximate (`created_at` of the progress row); low stakes since the flag is off in production.
- Apply by hand in the Supabase Dashboard (per CLAUDE.md). Add both tables to `SCHEMA.md` (+ index rows).

## 2. Pure logic — `src/lib/confidence-trend.ts` (no Supabase; unit-testable)
- `buildSkillTrends(input)` → per skill: ordered ratings `{value, date, assignmentTitle|null, courseId, courseName}`, `breakpoints` (index where course changes between consecutive ratings — handles alternating/concurrent courses), `events` (mastered/reactivated positioned by timestamp), `goals` (history newest-first, current = latest), `status` (`active` | `mastered` | `reactivated`, `pendingNew`), latest rating.
- `latestRatingPerStudentSkill(ratings)` and `computeClassStats(values)` → `{n, average, median, distribution[1..10]}` (works for n=1).
- Label helpers reuse `STUDY_PLAN_OPTIONS` from `src/lib/confidence-tracker-validation.ts`.

## 3. Data loaders — `src/lib/confidence-trend-data.ts`
- **`loadStudentTrend(supabase, service, studentId)`**: own ratings/progress/goal_history/events via the RLS client; assignment title + course name via the service client keyed by the student's own assignment ids (chain `assignments → module_days!module_day_id → modules → courses`, **no** `deleted_at` filters so ratings on removed assignments still render with a generic label; course = `module_day_id` path, not `linked_day_id`, per `src/lib/course-scope.ts`).
- **`loadCourseTrend(service, courseId)`** (caller has already passed the access check): roster = `course_enrollments` `role='student'` (the gradebook filter, `gradebook/page.tsx:89-94`), course skill set = skills tagged (`confidence_tracker_assignment_skills`) on the course's non-deleted assignments; then **one** ratings query `.in('student_id', roster).in('skill_id', skillSet)` via `fetchAllRows` (`src/lib/supabase/paginate.ts`, with stable `.order('created_at').order('id')`) returns both this-course and earlier-course ratings; classify each by course via chunked assignment lookups. Class stats use only current-course ratings (latest per student/skill); earlier-course ratings are drill-in context only. Also load progress/goal_history/events for those students/skills.

## 4. Server action — `src/lib/confidence-trend-actions.ts` (`'use server'`)
`reactivateConfidenceSkill(skillId)` → `{ error: string | null }`: flag off → error; unauthenticated → error; `users.role` admin/instructor/staff → error; guarded `UPDATE … WHERE student_id = auth.uid() AND skill_id = ? AND is_mastered = true` with `.select('id')`; zero rows → friendly "not mastered right now" (harmless double-click/second-tab no-op). Use `createServerSupabaseClient()` (RLS UPDATE policy already exists).

## 5. UI
- **Student**: `src/app/student/skill-confidence/page.tsx` (server; mirrors `student/readiness/page.tsx` skeleton: `force-dynamic`, auth redirect, `StudentTopNav`, `<main id="main-content" …>`; `notFound()` when flag off) → client `src/components/ui/SkillConfidenceView.tsx`: "Skills you're working on" (reactivated skills show a "Previously mastered on …, reactivated on …" note and "will come back on your next tagged assignment" when pending-new) and a "Mastered" section. Per skill: shared `SkillTrendChart` (recharts, with `role="img"` + aria-label summary), current goal block (target date shown plainly, "maintaining" variant, latest rating beside goal, **no** celebration/overdue wording), goal-history `<details>`, dated rating list `<details>` (the non-visual equivalent). Empty state. Reactivate → existing `Modal` (`src/components/ui/Modal.tsx`) confirm → `useTransition` + action → inline error on failure, `router.refresh()` on success; disabled for staff viewers.
- **Instructor**: `src/app/instructor/courses/[id]/skill-confidence/page.tsx` (server): `getInstructorOrTaAccess(id, …)` then `if (isTa) redirect(`/instructor/courses/${id}`)` (existing inline pattern, e.g. `readiness/page.tsx:19`) + flag `notFound()`; `InstructorTopNav` + `InstructorSidebar` + client `SkillConfidenceInstructorView.tsx`: class-overview cards per skill (average, median, distribution bars, "N students rated"), roster with expandable per-student skill trends (reusing `SkillTrendChart`, earlier-course ratings badged read-only with course breakpoints, mastered/reactivated dates, goal history), "no data" rows for unrated students, skill and student `<select>` filters. Read-only — no reactivate control.
- **Navigation/links (all flag-gated)**:
  - Student nav: new `src/app/student/layout.tsx` (server, reads the flag) wraps children in a small client context provider; `StudentTopNav.tsx` `ToolsDropdown` reads it to show "Skill Confidence". (Avoids touching 21 call sites; no student layout exists today, so the layout does no auth.) `NavMobileMenu` has no Tools links today — existing gap, out of scope.
  - Instructor nav: `InstructorSidebar` (server) reads the flag and passes `showSkillConfidence` to `InstructorCourseNav.tsx`, which renders `!isTa && showSkillConfidence && navLink('Skill Confidence','skill-confidence')` after line 211 and adds the slug to `COURSE_SLUGS` (line 23).
  - Old pages: link in `src/app/student/confidence/page.tsx` above `<ConfidenceTracker>` and in the header block of `src/app/instructor/courses/[id]/confidence/page.tsx` (`:139-142`, hidden for TAs). No other change to either.

## 6. Tests (`./tests`, Vitest conventions from existing confidence tests)
- `confidence-trend.test.ts` (pure): ordering, single/alternating course breakpoints, mastered→reactivated→mastered events and dates, goal history order/current goal, class stats (odd/even median, n=1, latest-per-student), maintaining/no-goal/past-date cases.
- `SkillConfidenceView.test.tsx` (mock `recharts` and the action): sections, empty state, reactivate only on mastered, confirm modal → action called with skill id, error shown and skill stays mastered, disabled for staff, "previously mastered" indicator, neutral past-date wording.
- `SkillConfidenceInstructorView.test.tsx`: overview figures + "N students rated", no-data students listed, skill/student filters, earlier-course ratings badged read-only, no reactivate button.
- `reactivate-confidence-skill.test.ts` (mock `@/lib/supabase/server` + flag; first action-level test in the repo): flag off, unauthenticated, staff role, not-mastered/other-student (0 rows), success payload resets all listed fields, repeat is a no-op.
- Old-page links and trigger behavior aren't unit-testable (async server pages / SQL) — covered in live verification.

## 7. Docs
Update `SCHEMA.md` and the Confidence Tracker paragraph in `CLAUDE.md` as part of implementation. Do **not** mark Phase 4 done in `_plans/confidence-tracker-v2-roadmap.md` until the plan is actually implemented and verified (keep the "retire old tracker" follow-up as is). The roadmap should only get a link to this plan for now.

## Verification
1. `npm test`, `npm run lint`, `npm run build`.
2. Apply the migration in the Supabase Dashboard; with the flag on in `.env.local`, run `npm run dev` and use the app in the browser preview:
   - Student: rate a tagged skill 10 on two assignments across two courses → chart shows a course breakpoint and a "mastered" marker; skill sits in the Mastered section; Reactivate → confirm → skill returns with the previously-mastered note; next tagged assignment shows the "New" tag, allows a new goal, and the old goal stays in history; two more 10s re-master it and the page lists both cycles.
   - Check the SQL side: rows appear in `confidence_tracker_goal_history` / `confidence_tracker_skill_events`, and a re-run of the backfill adds no duplicates.
   - Instructor/staff: class overview numbers match hand-computed values; a student's drill-in shows the earlier-course ratings; a TA and a student cannot open the page; students who left the course are absent.
   - Flag off: neither page loads, no nav or old-page links appear, reactivate is rejected. Verify light/dark/high-contrast and mobile width.
3. Delete all test data created during verification (as in Phase 3).
