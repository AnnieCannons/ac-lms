# Assignment Skill Tagging (confidence-tracker-v2, Phase 1)

## Context
This is Phase 1 of a larger initiative to prompt students to rate their confidence on skills right after submitting an assignment (later phases). Before that can exist, assignments need to be tagged with a canonical, shared list of skills — today there's no such thing. Per [`_specs/assignment-skill-tagging.md`](../_specs/assignment-skill-tagging.md), this phase is purely the data foundation + an instructor-facing tagging UI. No student-facing behavior changes.

**Key discovery made during planning**: the repo already has an unrelated `assignments.skill_tags`/`modules.skill_tags` (`text[]`) feature powering "Level Up Your Skills" (student-facing browsing/filtering of bonus content — `LevelUpFilter.tsx`, `CourseOutlineAccordion.tsx`, `BonusAssignmentList.tsx`, `/student/courses/[id]/level-up`, and more). It's a preset-list + free-text array with no dedup/canonicalization — not a fit for confidence tracking, which needs a real shared taxonomy so a skill can be recognized as "the same skill" across many assignments over time. Per your decision, this phase builds a **second, separate, distinctly-named system** alongside the untouched Level Up feature — different tables, different UI field, no shared code. There's also a *third*, unrelated `confidence_skills`/`confidence_entries` (per-student, free-text) table from the original Confidence Tracker — also untouched.

To avoid any naming collision across these three systems, new tables/UI are prefixed/labeled distinctly: **"Confidence Skills"** in the UI, `confidence_tracker_skills` / `confidence_tracker_assignment_skills` in the schema.

## Database

New migration (e.g. `supabase/migrations/<timestamp>_confidence_tracker_skills.sql`), following the join-table convention from `partner_type_assignments` (`supabase/migrations/20260519000002_partnerships_step2.sql`):

- **`confidence_tracker_skills`**: `id uuid PK`, `name text not null` (display name, preserves instructor's casing), `normalized_name text not null unique` (lowercased, whitespace/punctuation stripped — see normalization function below), `created_at`.
- **`confidence_tracker_assignment_skills`**: `id uuid PK`, `assignment_id uuid FK -> assignments(id) ON DELETE CASCADE`, `skill_id uuid FK -> confidence_tracker_skills(id) ON DELETE CASCADE`, `UNIQUE(assignment_id, skill_id)`, `created_at`.
- **RLS**: unlike the single `FOR ALL` policy on `partner_type_assignments`, this needs asymmetric read/write since a later phase will have students read tagged skills: a `SELECT` policy open to any authenticated user, and a separate `ALL`-for-writes policy restricted to `users.role IN ('admin','instructor','staff')` (no TA allowance — decided explicitly in the spec). Grant broadly at the SQL level per repo convention, rely on RLS for gating.

Update `SCHEMA.md` with both new tables, following the existing entry format.

## Server logic — new `src/lib/skill-actions.ts`

- `normalizeSkillName(name: string): string` — pure function: lowercase, strip all whitespace and punctuation (so "Node.js", "Node JS", "node  js" all normalize identically). This is the one piece of pure, easily unit-testable logic.
- `requireConfidenceSkillAccess()` — mirrors `requireStaffOrAdmin` in `src/lib/partner-actions.ts:62` (checks `users.role IN ('admin','instructor','staff')`), but with no course/TA branch — TAs are explicitly excluded per the spec, unlike `requireCourseInstructorAccess` in `src/lib/course-access.ts` which would allow them.
- `listSkills()` — returns all `{id, name}` rows. Given the list starts empty and grows slowly, fetch-all-then-filter-client-side is the right scale (same approach `StateCombobox` in `src/components/ui/PartnerForm.tsx:67` uses against its static `US_STATES` list).
- `createSkill(name)` — normalizes, checks `requireConfidenceSkillAccess()`, inserts or returns the existing row if `normalized_name` already exists (handles the race case where two instructors create "the same" skill near-simultaneously via the `UNIQUE` constraint + a catch-and-refetch-on-conflict).
- `renameSkill(skillId, newName)` — checks access, updates `name`/`normalized_name`; since every assignment references the skill by `skill_id`, the rename is instantly visible everywhere.
- `setAssignmentSkills(assignmentId, skillIds, courseId)` — checks access, diffs and replaces the assignment's rows in `confidence_tracker_assignment_skills`. Called as its own action after the main assignment save (not folded into `AssignmentEditor.tsx`'s existing direct `supabase.from('assignments').update()` call, since tag creation needs a server-side access check `assignments` table updates don't currently have — matches the repo's existing mixed pattern of server actions for access-gated writes vs. direct client calls for simple field edits).

## UI — new `src/components/ui/ConfidenceSkillsField.tsx`

A creatable multi-select combobox, structurally inspired by `StateCombobox` (`PartnerForm.tsx:67`) for its dropdown-positioning technique (manual `getBoundingClientRect()` + `position: fixed`, to escape `overflow:hidden` ancestors) — but extended since `StateCombobox` is single-value, non-creatable, and has no keyboard `Enter` handling:
- Type to filter `listSkills()` results using `normalizeSkillName` for matching (not plain substring).
- Click or `Enter` on a highlighted suggestion adds it as a removable tag/chip.
- `Enter` on unmatched text calls `createSkill()` immediately and adds the result as a tag.
- Each existing skill's chip/dropdown row has an inline rename affordance (e.g. an edit icon) calling `renameSkill()`.
- Removing a tag from the assignment only removes the `confidence_tracker_assignment_skills` row, never the skill itself.

## Wiring into the Assignment Editor

In `src/components/ui/AssignmentEditor.tsx`, add a new "Confidence Skills" section — visually and functionally separate from the existing "Skill Tags" section (lines ~431-465, untouched). On mount, load the assignment's current confidence skills; on save, call `setAssignmentSkills()` alongside the existing `save()` flow (lines 214-240).

## Testing (new — no test infra exists today)

Per your decision to introduce a `./tests` folder properly for this feature, add **Vitest + React Testing Library** (recommended over Jest: avoids `next/jest`'s SWC-config wrapping, which lags on brand-new Next versions like this repo's 16.3.2; no conflict with `next.config.ts`'s `serverExternalPackages` since Vitest's `jsdom` environment runs in a separate process from Next's own bundler).

- New devDependencies: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom`, `vite-tsconfig-paths`.
- New `vitest.config.ts` at repo root: `environment: 'jsdom'`, `plugins: [tsconfigPaths(), react()]`, `test.include: ['tests/**/*.test.{ts,tsx}']` (restricts discovery to the new `./tests` folder rather than Vitest's default repo-wide glob).
- New `package.json` script: `"test": "vitest run"`.
- Update `CLAUDE.md`'s Commands section — it currently states no test suite exists; add `npm test` and a one-line note on the Vitest+RTL setup.
- Tests (mock `skill-actions` via `vi.mock` in component tests — no real Supabase test DB exists, so component tests verify UI/interaction only, not persistence):
  - `tests/normalizeSkillName.test.ts`: case-insensitivity, whitespace/punctuation collapsing (the "Node.js"/"Node JS" case from the spec), trimming, rejecting empty/whitespace-only input.
  - `tests/ConfidenceSkillsField.test.tsx`: typing filters suggestions; selecting an existing suggestion (click and Enter) adds a tag without duplicating; Enter on unmatched text creates and adds a new tag; removing a tag doesn't call any skill-deletion function; renaming updates the displayed name.

## Verification
1. Run `npm test` — confirm the new unit + component tests pass.
2. Start the dev server, open an existing assignment in the Assignment Editor as an instructor, and confirm the new "Confidence Skills" field renders separately from the existing untouched "Skill Tags" field.
3. Type a few characters, confirm the dropdown filters case-insensitively; type a skill name that varies only in punctuation/whitespace from an existing one (e.g. "Node.js" vs "Node JS") and confirm it matches rather than offering to create a duplicate.
4. Create a brand-new skill via Enter, save the assignment, reload the page, and confirm the tag persisted.
5. Tag the same skill on a second assignment, rename it from either assignment's field, and confirm the new name shows on both.
6. Remove a tag from an assignment, then confirm the skill still appears as a suggestion when tagging a different assignment (i.e. it wasn't deleted).
7. Confirm the existing Level Up feature (`/student/courses/[id]/level-up`, the old "Skill Tags" pills in the Assignment Editor) is visually and functionally unchanged.
8. Confirm a TA account cannot create/rename/tag confidence skills (check both the UI and, more importantly, that `createSkill`/`renameSkill`/`setAssignmentSkills` reject a TA server-side even if the UI were somehow reached — matching this repo's existing pattern of not trusting page-level gating alone for access control).
