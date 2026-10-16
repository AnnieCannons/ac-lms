# New-Skill Goal & Study Plan Capture (confidence-tracker-v2, Phase 3)

## Context
This is Phase 3 of the confidence-tracker-v2 initiative (see [`_plans/confidence-tracker-v2-roadmap.md`](./confidence-tracker-v2-roadmap.md) and the spec [`_specs/confidence-new-skill-goal.md`](../_specs/confidence-new-skill-goal.md)). Phase 2 (merged, flag-gated) captures a plain, optional 1–10 rating per tagged skill on a student's first-ever submission of an assignment. Phase 3 extends this: the first time a student ever rates a given skill (across any assignment), it's marked "New," and once rated, the student can optionally set a goal — which, if set, requires a target date and a study plan. A rating of 10 has no numeric goal above it, so it becomes a "maintaining this rating" state instead; the system separately tracks how many times a skill has been rated 10, and once that happens twice the skill is "mastered" and stops being offered for rating (reactivation is an explicit Phase 4 trend-page feature, out of scope here). Everything ships behind the existing `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` flag, so none of this is visible in production until the whole feature (through Phase 6) is ready.

## Decided during planning
- **One server action call, not two.** Goal data rides along on the same `saveConfidenceRatings` call as the rating itself (as an optional `goal` field per entry), not a separate `saveConfidenceGoals` action — simpler, one failure mode, one round trip.
- **Incomplete goal blocks Submit** (explicit product decision): once a goal is set for any skill (kept at auto-default or edited), Submit is disabled until that skill's target date and study plan are both filled in. This is a deliberate, one-off exception to this feature's otherwise fully-optional/never-blocks pattern — worth a code comment explaining why.
- **Goal input reuses the existing SCALE-button style** (a mini radiogroup over the valid range) rather than a plain number input, for visual consistency with the rating control already in the same card.
- **Mastery tracking is a new mutable summary table**, `confidence_tracker_skill_progress` (one row per student+skill), deliberately separate from the immutable, append-only `confidence_tracker_ratings` audit trail (which has no UPDATE/DELETE policy by design). This gives Phase 4's future "reactivate" action a plain `UPDATE` to flip state back — no new migration needed then.

## Key existing code to reuse (found during exploration)
- `saveConfidenceRatings` in [`src/lib/confidence-tracker-actions.ts`](../src/lib/confidence-tracker-actions.ts) (56 lines) — Phase 2's only server action. Uses only `createServerSupabaseClient()` (no service-role client in this feature); enforces "at most once per assignment" via an app-level existence check, not a DB constraint; validates ratings against actually-tagged skills. Extended in place, not replaced.
- `ConfidenceRatingPrompt.tsx` in `src/components/ui/` — one component instance renders the whole list of tagged skills (not one per skill), fully controlled via `value`/`onChange` props, no internal state. Extended in place with new `goals`/`onGoalChange` props.
- `SubmissionForm.tsx` — `showRatingPrompt`, the `confidence-ratings:${studentId}:${assignmentId}` sessionStorage key, `handleRatingChange`, and the `handleSubmit`/`handleDraft` split are all Phase 2 precedent to mirror exactly for the new goal data.
- `DatePickerField.tsx` — reused for the target date, but currently has no `minDate`/`maxDate`/`disabled` props; add them, wiring into `react-day-picker`'s `disabled={{before, after}}` matcher (precedent already exists in `RequestExtensionButton.tsx:365`, used directly with `DayPicker` rather than through `DatePickerField`).
- `PartnerForm.tsx`'s `{options.includes('Other') && <input .../>}` idiom — the pattern to adapt for the study-plan single-select's "Other" free-text reveal (no existing single-select-with-Other component; only checkbox/pill-toggle precedent exists).
- `globals.css`'s `.badge-amber`/`.status-grading-card`/`.alert-error` classes — dark-mode-safe CSS class convention to follow for the new `.badge-new` class (reusing the already theme-aware `--color-teal-light`/`--color-teal-primary` vars, same approach as `.status-grading-card`, simpler than `.badge-amber`'s hardcoded-hex + separate dark-mode override).
- Migration/RLS conventions to mirror exactly: `confidence_tracker_ratings`'s own migration (`CREATE TABLE` → indexes → `ENABLE RLS` → `CREATE POLICY` select/insert split → `GRANT ALL ... TO anon/authenticated/service_role`), and the simple `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` precedent (`20260720130810_assignment_is_optional.sql`) for idempotent, additive migrations.
- Test conventions to mirror: `tests/ConfidenceRatingPrompt.test.tsx` and `tests/SubmissionForm.confidenceRatings.test.tsx` (`vi.mock` whole modules, `vi.mocked(...).mockResolvedValue(...)`, a `renderForm(overrides)`/fixture helper, explicit "does NOT call X" assertions).

## Database
New migration `supabase/migrations/20260928000000_confidence_tracker_skill_progress.sql`:

```sql
CREATE TABLE IF NOT EXISTS confidence_tracker_skill_progress (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id          uuid NOT NULL REFERENCES confidence_tracker_skills(id) ON DELETE CASCADE,

  -- True until this student's first-ever (or first-since-reactivation) rating for this
  -- skill is captured. Phase 4's future reactivate action flips it back to true — this
  -- is the schema headroom Phase 4 needs, with no new migration required then.
  is_new_pending    boolean NOT NULL DEFAULT true,

  goal              int,               -- numeric goal; NULL when no goal set OR "maintaining" (see goal_is_maintain)
  goal_is_maintain  boolean NOT NULL DEFAULT false,
  target_date       date,
  study_plan        text,
  study_plan_other  text,

  ten_rating_count  int NOT NULL DEFAULT 0,
  is_mastered       boolean NOT NULL DEFAULT false,
  mastered_at       timestamptz,
  reactivated_at    timestamptz,       -- unused until Phase 4; present now to avoid a later migration

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (student_id, skill_id),
  CHECK (goal IS NULL OR goal BETWEEN 2 AND 10),
  CHECK (NOT goal_is_maintain OR goal IS NULL),
  CHECK (
    (goal IS NULL AND NOT goal_is_maintain AND target_date IS NULL AND study_plan IS NULL AND study_plan_other IS NULL)
    OR ((goal IS NOT NULL OR goal_is_maintain) AND target_date IS NOT NULL AND study_plan IS NOT NULL)
  ),
  CHECK (study_plan IS NULL OR study_plan IN
    ('practice_alone','review_lessons','ta_help','outside_tutorials','flashcards','review_notes','other')),
  CHECK (study_plan IS DISTINCT FROM 'other' OR (study_plan_other IS NOT NULL AND length(btrim(study_plan_other)) > 0)),
  CHECK (study_plan = 'other' OR study_plan_other IS NULL),
  CHECK (target_date IS NULL OR (target_date > CURRENT_DATE AND target_date <= CURRENT_DATE + 14)),
  CHECK (ten_rating_count >= 0),
  CHECK (NOT is_mastered OR mastered_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_confidence_tracker_skill_progress_student_id ON confidence_tracker_skill_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_confidence_tracker_skill_progress_skill_id ON confidence_tracker_skill_progress(skill_id);

ALTER TABLE confidence_tracker_skill_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students read own confidence_tracker_skill_progress, staff read all"
  ON confidence_tracker_skill_progress FOR SELECT
  USING (auth.uid() = student_id OR EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin','instructor','staff')));

CREATE POLICY "students insert own confidence_tracker_skill_progress"
  ON confidence_tracker_skill_progress FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Needed now (a later plain 10-rating updates the same row's count) and reused as-is by
-- Phase 4's reactivate control later.
CREATE POLICY "students update own confidence_tracker_skill_progress"
  ON confidence_tracker_skill_progress FOR UPDATE
  USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

GRANT ALL ON TABLE public.confidence_tracker_skill_progress TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION update_confidence_tracker_skill_progress_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER confidence_tracker_skill_progress_updated_at
  BEFORE UPDATE ON confidence_tracker_skill_progress
  FOR EACH ROW EXECUTE FUNCTION update_confidence_tracker_skill_progress_updated_at();

-- Backfill: any student/skill pair already rated is not "new" going forward, and its
-- historical 10-ratings already count toward mastery.
INSERT INTO confidence_tracker_skill_progress (student_id, skill_id, is_new_pending, ten_rating_count, is_mastered, mastered_at)
SELECT student_id, skill_id, false,
  count(*) FILTER (WHERE rating = 10),
  count(*) FILTER (WHERE rating = 10) >= 2,
  CASE WHEN count(*) FILTER (WHERE rating = 10) >= 2 THEN now() END
FROM confidence_tracker_ratings
GROUP BY student_id, skill_id
ON CONFLICT (student_id, skill_id) DO NOTHING;
```

Apply manually via the Supabase Dashboard SQL editor, per this repo's existing convention (no CLI/migration runner). Also add a matching `### confidence_tracker_skill_progress` section to `SCHEMA.md`, right after the existing `confidence_tracker_ratings` entry, mirroring its table format, plus an indexes-table row.

Note: the `goal BETWEEN 2 AND 10` / `target_date` CHECKs are coarse defense-in-depth (matching the existing `rating BETWEEN 1 AND 10` precedent) — the real relative rule (`goal ≥ rating + 1`) can't be expressed as a single-table CHECK since `rating` lives in a different table, so it's enforced in application code (`validateGoalInput`, below).

## Server logic — extend `src/lib/confidence-tracker-actions.ts`

```ts
export const STUDY_PLAN_OPTIONS = [
  { value: 'practice_alone',    label: 'Practice on my own (exercises, coding challenges, repetition)' },
  { value: 'review_lessons',    label: 'Review the lesson materials again' },
  { value: 'ta_help',           label: 'Get help from a TA or instructor' },
  { value: 'outside_tutorials', label: 'Watch outside tutorials or videos' },
  { value: 'flashcards',        label: 'Study flashcards' },
  { value: 'review_notes',      label: 'Review class notes' },
  { value: 'other',             label: 'Other' },
] as const
export type StudyPlan = typeof STUDY_PLAN_OPTIONS[number]['value']

export interface ConfidenceGoalInput {
  goal: number | 'maintain'   // 'maintain' only valid when the paired rating === 10
  targetDate: string          // 'YYYY-MM-DD'
  studyPlan: StudyPlan
  studyPlanOther?: string
}

export interface ConfidenceRatingInput {
  skillId: string
  rating: number
  goal?: ConfidenceGoalInput   // only honored server-side if this skill is still "new" for the student
}

export interface ConfidenceSkillWithStatus extends ConfidenceSkill { isNew: boolean }

export interface GoalState {
  goal: number | 'maintain' | null   // null = no goal set/cleared
  targetDate: string                  // '' = unset
  studyPlan: string                   // '' = unset, else a StudyPlan value
  studyPlanOther: string
}

// Pure, Supabase-free — directly unit-testable, and the server never trusts client input anyway.
export function isValidTargetDate(dateStr: unknown, today = new Date()): boolean { /* strictly future, ≤14 days out */ }
export function validateGoalInput(rating: number, input: ConfidenceGoalInput | undefined):
  { goal: number | null; goalIsMaintain: boolean; targetDate: string; studyPlan: StudyPlan; studyPlanOther: string | null } | null {
  /* rating===10 → only 'maintain' accepted; else goal must be integer in [rating+1, 10];
     studyPlan must be one of STUDY_PLAN_OPTIONS; studyPlanOther required+trimmed iff studyPlan==='other';
     targetDate must pass isValidTargetDate. Any failure → return null (drop the goal, keep just the rating). */
}
export function nextMasteryState(priorCount: number, priorIsMastered: boolean, rating: number):
  { tenRatingCount: number; isMastered: boolean; justMastered: boolean } {
  /* rating!==10 → unchanged. rating===10 && already mastered → unchanged, justMastered:false (idempotent,
     matters once Phase 4 reactivation exists). rating===10 && not mastered → count+1, isMastered = count+1>=2. */
}

export async function getAssignmentSkillsForStudent(assignmentId: string):
  Promise<{ error: string | null; skills: ConfidenceSkillWithStatus[] }> {
  // 1. listAssignmentSkills(assignmentId) for the tagged set (unchanged, still used as-is by
  //    the instructor tagging UI in skill-actions.ts — do not modify that function).
  // 2. Fetch confidence_tracker_skill_progress rows for (student, tagged skill ids).
  // 3. Filter OUT any tagged skill whose progress row has is_mastered = true (hard
  //    server-side exclusion — mirrors the "resources.instructor_only filtered server-side"
  //    invariant in CLAUDE.md; never rely on the client to hide a mastered skill).
  // 4. Map remaining skills to { ...skill, isNew: progressRow?.is_new_pending ?? true }.
}
```

`saveConfidenceRatings` changes (keep the existing "any prior rating for this assignment → no-op" guard first, unchanged):
1. After the existing tagged-skill filter, fetch `confidence_tracker_skill_progress` rows for the candidate skills, and **re-filter out any that are already `is_mastered`** (server-side gate — never trust a stale client list).
2. Insert the rating rows exactly as today.
3. For every remaining candidate, upsert (`onConflict: 'student_id,skill_id'`) a **full** `confidence_tracker_skill_progress` row: `is_new_pending: false`; `goal`/`goal_is_maintain`/`target_date`/`study_plan`/`study_plan_other` from `validateGoalInput(rating, entry.goal)` **only if the row was previously new** (else preserve the existing stored values — an existing skill's later plain ratings must never overwrite its already-captured goal); `ten_rating_count`/`is_mastered`/`mastered_at` from `nextMasteryState`. Always write the full row — Supabase's batch upsert unions columns across the whole payload, so omitting a key isn't a safe way to "preserve" a value.

**Assignment page** (`src/app/student/courses/[id]/assignments/[assignmentId]/page.tsx:124`): swap the `listAssignmentSkills` call for `getAssignmentSkillsForStudent` (still gated by the same `isConfidenceRatingsEnabled()` check already there). `SubmissionForm`'s `confidenceSkills` prop type widens from `ConfidenceSkill[]` to `ConfidenceSkillWithStatus[]`. Student Preview/Observer both already flow through this using the previewing user's own `auth.uid()` — no special-casing needed, matches how `studentId` already works for those modes today.

## `DatePickerField.tsx` — add bounds + disabled
Add `minDate?: Date`, `maxDate?: Date`, `disabled?: boolean` props. Wire into the existing (currently absent) `<DayPicker>` call: `disabled={(minDate || maxDate) ? { before: minDate, after: maxDate } : undefined}` — same `{before, after}` matcher shape already used in `RequestExtensionButton.tsx:365`. Disable the trigger `<button>` and no-op `handleOpen` when `disabled`. Purely additive — no existing caller passes these, so nothing else changes.

## UI — extend `ConfidenceRatingPrompt.tsx`
Props widen to:
```ts
interface Props {
  skills: ConfidenceSkillWithStatus[]   // was ConfidenceSkill[]
  value: Record<string, number>
  onChange: (skillId: string, rating: number | null) => void
  goals: Record<string, GoalState>              // NEW
  onGoalChange: (skillId: string, goal: Partial<GoalState> | null) => void  // NEW
  disabled?: boolean
}
```
`GoalState`/`ConfidenceSkillWithStatus` are imported from `confidence-tracker-actions.ts` (single source of truth for both this component and `SubmissionForm`).

Per-skill rendering, inside the existing per-skill `<div>` (same card, no new wrapper, per the spec's "expanding inline" note):
- Always render a `.badge-new` `<span>New</span>` right after `skill.name` when `skill.isNew` — independent of rating state.
- Existing 10-button radiogroup unchanged.
- When `skill.isNew && value[skill.id] != null`: render the goal section.
  - If `value[skill.id] === 10`: no numeric goal control — show "You're already at the top of the scale — you're maintaining this rating." and set the goal state to `'maintain'`.
  - Else: a mini SCALE-style button row (same visual language as the rating radiogroup) over the range `[value[skill.id]+1, 10]`, defaulting to `Math.min(value[skill.id]+2, 10)`.
  - A "clear goal" affordance (re-clicking the selected value, matching the rating control's own unselect idiom) sets goal back to `null`, which hides target date/study plan and discards their values.
  - When goal is non-null: `DatePickerField` for target date (`minDate = tomorrow`, `maxDate = today+14`, default `today+7`) and a `<select>` of the 7 `STUDY_PLAN_OPTIONS` (default unset — no natural default), revealing a text `<input>` when `study_plan === 'other'` (mirrors the `PartnerForm.tsx` reveal idiom).
- Auto-suggest wiring: the same click handler that calls `onChange(skillId, n)` for an `isNew` skill transitioning from unset→set also calls `onGoalChange(skillId, { goal: n===10 ? 'maintain' : Math.min(n+2,10), targetDate: <today+7>, studyPlan: '', studyPlanOther: '' })`. Clearing the rating (`onChange(skillId, null)`) also calls `onGoalChange(skillId, null)`.
- All new inputs get `disabled={disabled}` threaded through, same as the existing radios (layer 1 of the triple Student-Preview/Observer disable — layers 2/3 are unchanged in `SubmissionForm`).
- `goals`/`onGoalChange` are required props (not optional-with-no-op defaults) since `SubmissionForm` always supplies them — existing calls in `tests/ConfidenceRatingPrompt.test.tsx` need `goals={{}}` and `onGoalChange={vi.fn()}` added.

## Wiring into `SubmissionForm.tsx`
- New state: `const [goals, setGoals] = useState<Record<string, GoalState>>({})`.
- New sessionStorage key `` `confidence-goals:${studentId}:${assignmentId}` `` (sibling to the existing `confidence-ratings:...` key — kept separate rather than reshaping the existing key, since that shape (`Record<string, number>`) can't hold the new fields and this keeps Phase 2's own hydration/write code untouched). Hydrate in the same mount-only `useEffect` that already hydrates `ratings`.
- `handleGoalChange(skillId, patch)`: mirrors `handleRatingChange` — `patch === null` deletes the key, else merges `{ goal: null, targetDate: '', studyPlan: '', studyPlanOther: '', ...prev, ...patch }`; writes to the new sessionStorage key on every change.
- `clearStoredRatings` → rename `clearStoredConfidenceData`, removes both keys.
- **New computed value gating Submit** (per the "block submit until complete" decision):
  ```ts
  const isGoalIncomplete = Object.values(goals).some(g =>
    g.goal !== null && (!g.targetDate || !g.studyPlan || (g.studyPlan === 'other' && !g.studyPlanOther.trim()))
  );
  ```
  Thread into the Submit button's existing `disabled={...}` expression (alongside `isStudentPreview`), and show a small inline hint near the button when true, e.g. "Finish setting your skill goal(s) above before submitting." This is the one place in this feature where something now blocks Submit — add a code comment explaining why, given every other confidence-tracker input is best-effort.
- `handleSubmit`: after `doSave("submitted", ...)` succeeds, build `entries` same as today but attach `goal` per skill when `goals[skillId]?.goal != null`:
  ```ts
  const entries = Object.entries(ratings).map(([skillId, rating]) => {
    const g = goals[skillId];
    const goal = g?.goal != null ? {
      goal: g.goal,
      targetDate: g.targetDate,
      studyPlan: g.studyPlan as StudyPlan,
      studyPlanOther: g.studyPlan === 'other' ? g.studyPlanOther : undefined,
    } : undefined;
    return { skillId, rating, goal };
  });
  ```
  Call `saveConfidenceRatings(assignmentId, entries)` exactly as today (one call, no second action) — the existing `ratingError` state/banner covers a goal-save failure too, since it's the same call; tweak the message to mention "confidence rating or goal" instead of just "ratings". `clearStoredConfidenceData()` replaces `clearStoredRatings()`.
- `handleDraft` stays untouched — never touches `goals`, exactly like it never touches `ratings` today.
- Render wiring: pass `goals={goals}` and `onGoalChange={handleGoalChange}` to `ConfidenceRatingPrompt` alongside the existing props; `disabled={isObserver || isStudentPreview}` unchanged.

## `globals.css`
Add, next to the existing `.badge-*`/`.status-*` rules (~line 298 area):
```css
/* "New" skill badge — Confidence Tracker Phase 3. Reuses the teal accent vars (already
   theme/high-contrast-aware, same approach as .status-grading-card) rather than hardcoded
   hex + a separate dark-mode override block like .badge-amber uses. */
.badge-new {
  background-color: var(--color-teal-light);
  color: var(--color-teal-primary);
  border-color: var(--color-teal-primary);
}
```
Optional low-risk cleanup (not required, but touches a line Phase 3 already needs to generalize): extract the existing inline amber `ratingError` styling in `SubmissionForm.tsx` into a new `.alert-warning` class mirroring `.alert-error`'s light/dark-mode pair, since Phase 3 reuses that same banner for a second failure case.

## Tests
- **New `tests/confidence-tracker-actions.test.ts`** (plain Vitest, no mocking — these are pure functions): `validateGoalInput` (rating 9/goal 10 valid; rating 9/goal 9 invalid; default rating+2 valid; rating+1 floor valid; >10 invalid; rating 10 + `'maintain'` valid; rating 10 + numeric goal invalid; `study_plan:'other'` + blank other invalid; trimmed other valid; unrecognized study_plan invalid); `isValidTargetDate` (today invalid, +1 valid, +14 valid, +15 invalid, malformed invalid); `nextMasteryState` (0→7 unchanged; 0→10 becomes 1/not mastered; 1→10 becomes 2/mastered/justMastered; already-mastered stays mastered, justMastered=false).
- **Extend `tests/ConfidenceRatingPrompt.test.tsx`**: add `goals={{}}` / `onGoalChange={vi.fn()}` to all existing render calls; new cases — "New" badge shown/hidden per `isNew`; no goal section until rated; auto-suggest values on first rating; rating 9 caps suggestion at 10; rating 10 shows "maintaining" copy, no numeric input; clearing rating clears goal via `onGoalChange(skillId, null)`; clearing goal hides target date/study plan; "Other" reveals/hides the text input; `disabled` disables the new controls too.
- **Extend `tests/SubmissionForm.confidenceRatings.test.tsx`**: `confidenceSkills` fixtures carry `isNew`; New tag renders/withholds correctly; submitting a new skill's rating without touching goal fields still sends the auto-suggested defaults in the `saveConfidenceRatings` call args; rating 10 sends the "maintain" goal; clearing the goal before submit sends no `goal` field for that skill; Draft save never calls `saveConfidenceRatings` (existing test, unchanged); **Submit is disabled and shows the hint when a goal is set but study plan is empty** (new, per the blocking decision); Student Preview/Observer render accurate goal state but never trigger a save (extend the two existing tests). Mastered-skill exclusion needs no test here — it's filtered upstream in `getAssignmentSkillsForStudent`, which this component/form never sees un-filtered.

## Verification
- `npm test` — all new/extended Vitest suites above, plus the full existing suite to confirm no Phase 1/2 regression.
- `npm run lint` and `npm run build` — typecheck the widened `ConfidenceSkillWithStatus`/`GoalState` types through every call site.
- Apply the migration manually via the Supabase Dashboard SQL editor against a dev/staging project, then, with `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED=true` in local `.env.local`: rate a never-before-seen skill (confirm "New" tag, auto-suggested goal/date, blocked Submit until study plan chosen, then successful submit); rate the same skill again on a second assignment (confirm no "New" tag, no goal UI, plain rating only); drive a skill to two 10-ratings across two assignments and confirm it disappears from a third assignment's prompt; verify Student Preview/Observer show accurate state with no working save path; verify Draft save never persists goal data. This mirrors Phase 2's own "verified live end-to-end against real course data" step, since RLS-dependent behavior needs a real Supabase project, not just local mocks.
