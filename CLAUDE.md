# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start Next.js dev server (Turbopack)
npm run build    # production build
npm run start    # run a production build
npm run lint     # eslint (eslint-config-next: core-web-vitals + typescript)
npm test         # vitest run — see Testing below
```

### Testing
Vitest + React Testing Library, config in `vitest.config.mts`, tests live in `./tests` (not co-located with source). This is new as of the confidence-tracker-v2 work — most existing code predates it and has no test coverage; don't assume untested code is covered, and don't feel obligated to backfill tests for unrelated code you touch in passing. Component tests mock server actions via `vi.mock` rather than hitting a real Supabase instance — there's no test database in this repo.

### One-off / maintenance scripts (`scripts/`)
Scripts are run directly with `ts-node`, not compiled or added to `package.json`. The standard invocation (see the usage comment at the top of most scripts) is:
```bash
source .env.local && npx ts-node --esm scripts/<script-name>.ts [args]
```
Many take a `--dry-run` flag — check the script's header comment for exact usage before running one that mutates data.

### Importing a course
```bash
source .env.local && npx ts-node --esm scripts/import-course.ts <path-to-file>
```
Course JSON fixtures live in `src/data/<program>/` (`backend/`, `frontend/`, `itp/`, `tcf/`). After importing, clean up orphaned modules: `DELETE FROM modules WHERE title IS NULL OR title = '';`

### Environment
Local dev needs `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Without the service role key, any page/action that does a cross-user query (grading, admin views, most of `instructor/`) will throw at runtime rather than degrade gracefully.

## Architecture

Next.js App Router + TypeScript + Supabase (Postgres/auth/RLS), no separate backend. Business logic lives in `'use server'` action modules under `src/lib/` (one file per domain: `grade-actions.ts`, `quiz-actions.ts`, `partner-actions.ts`, `readiness-actions.ts`, etc.) rather than in `src/app/api/` route handlers — route handlers are reserved for cron jobs, webhooks, and file upload.

### Two Supabase clients — this distinction matters everywhere
`src/lib/supabase/server.ts` exports both:
- `createServerSupabaseClient()` — respects RLS, scoped to the logged-in user. Use for anything the current user should only see/touch as themselves.
- `createServiceSupabaseClient()` — bypasses RLS with the service role key. Required for cross-user reads (gradebook, roster, "all students" views). Always pair it with an explicit server-side role check (see below) — RLS isn't there to stop you.

`src/lib/supabase/client.ts` is the browser client, anon-key only, used in client components.

### Auth model: lightweight middleware, heavy per-page checks
`src/middleware.ts` deliberately does the bare minimum: it confirms *someone* is logged in and redirects unauthenticated users away from `/instructor/*` and `/flashcards/*`. It does **not** check role — a prior version queried role + TA enrollment on every request and occasionally hung until Vercel's edge timeout killed it. Instead, every protected page/server action re-verifies the caller's actual role itself, via one of:
- `src/lib/instructor-access.ts` (`getInstructorOrTaAccess`) — page-level, redirects on failure (to `/login`, `/unauthorized`, or a given student route).
- `src/lib/course-access.ts` (`requireCourseInstructorAccess`) — action-level, returns a typed result instead of redirecting, for use inside server actions.

Role model: `admin`/`instructor`/`student` live on `users.role` (global). `ta` is course-scoped, stored as plain text in `course_enrollments.role` — it is not a `users.role` value, so any role check that only looks at `users.role` will miss TAs. `instructor`/`staff`/`admin` are treated as globally trusted across all courses; `ta` access is valid only for the specific course they're enrolled in.

### Student preview mode
Instructors can preview a course as a student without a second account: a `student-view=<courseId>` cookie (`src/lib/student-preview.ts`) makes student pages bypass the enrollment check for that instructor. `isStudentPreview()` itself re-verifies the caller is staff before honoring the cookie, so a student can't set it to escalate.

### Course content model
`courses → modules → module_days → (resources | assignments)`, all soft-deletable via `deleted_at`. The course editor (`CourseEditor.tsx` and friends) uses three independently-scoped `@dnd-kit` `DndContext`s, nested: outer (module/day reorder, cross-day assignment moves via `useDraggable`/`useDroppable` rather than `useSortable`), day-level (resource reorder), assignment-level (checklist item reorder). `modules` state lives in `CourseEditor` because cross-day assignment drag needs it; resources and checklist items are fetched client-side inside their own components rather than server-rendered.

**Career Dev cross-posting**: a resource/assignment/quiz created under a Career Development module can also appear on a specific coding-week day via `linked_day_id`. Queries that populate a day's content must match `module_day_id = day.id OR linked_day_id = day.id`, not just the FK — a query using only `module_day_id` will silently drop cross-posted items.

### Security invariants (don't regress these)
- All user-authored rich HTML goes through `isomorphic-dompurify` before `dangerouslySetInnerHTML`.
- Grading actions (`saveGrade`, `markCompleteNoSubmission`) and role changes (`updateUserRole`) verify staff/admin server-side, independent of RLS — RLS is not the only gate for these.
- `resources.instructor_only` is filtered server-side for students, not just hidden in the UI.
- The upload route restricts to `lms-submissions`/`lms-resources` buckets, blocks path traversal, and caps size at 20MB.
- `/api/cron/*` routes check a `CRON_SECRET` bearer token against Vercel's cron `Authorization` header.

### Other domains beyond core course/grading
The app has grown well past its original course-management scope; these are real, separate feature areas, each with their own `src/lib/` action modules:
- **Flashcards** (`src/app/flashcards/`, `src/lib/flashcards/`) — spaced-repetition decks, sharing via `share_token`, admin activity views.
- **Partnerships CRM** (`src/app/instructor/partnerships/`, `src/lib/partner*-actions.ts`) — employer/funder tracking, contacts, interaction logs, ratings, Airtable-backed forms (`supabase/functions/airtable-form-webhook`).
- **Readiness / accountability** (`src/lib/readiness.ts`, `weekly-report.ts`) — a weekly 0–5 score from attendance + assignment data, feeding a red/yellow/green escalation flow that posts to Slack (`src/lib/slack.ts`) and email.

`SCHEMA.md` has full table definitions if you need to check a column or relationship rather than guessing from usage.
