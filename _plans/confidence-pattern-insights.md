# Pattern Insights (confidence-tracker-v2, Phase 7)

## Context
Phase 6 stores each student's optional "what helped" answer against the one met goal and skill it belongs to, but the answers are only shown one goal at a time. Phase 7 (spec: [`_specs/confidence-pattern-insights.md`](../_specs/confidence-pattern-insights.md), branch `claude/feature/confidence-pattern-insights`) adds a "What tends to help you" section to the existing My Skill Confidence page: for each method (flashcards, TA help, …) how many times it was named as helping, a simple bar, and which skills those times were on. No minimum, no averages, no rating math, student-only, nothing stored. Everything stays behind `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` (still off in production; never turn it on without asking).

## Findings that shape the design
- **No new query and no migration.** `loadStudentTrend` (`src/lib/confidence-trend-data.ts`) already loads every `confidence_tracker_goal_outcomes` row for all of the student's rated skills, and `buildSkillTrends` attaches them to `currentGoal` / `previousGoals` as `TrendGoal.met`. Mastered and reactivated skills, both cycles, renamed skills (live names) and deleted skills (cascade) are therefore already handled.
- **One gap:** `TrendGoalMet` only keeps display `answerLabels`, in which `own_plan` becomes the student's free text and `other` becomes "Other: …". Grouping by method from labels would be fragile, so add the raw option values (`answerValues: string[]`) in `toTrendGoal` (`src/lib/confidence-trend.ts:160`) from `outcome.whatHelped`.
- **`own_plan` is not in `WHAT_HELPED_OPTIONS`** (`src/lib/confidence-tracker-validation.ts`): the grouping logic must fold `own_plan` and `other` into one "Other" entry, counted once per goal even if both were chosen.
- **Staff / Student Preview / Observer / instructor:** `SkillConfidenceView` is used only by `src/app/student/skill-confidence/page.tsx` (the instructor page uses `SkillConfidenceInstructorView`), so the section is automatically absent for instructors, is flag-gated by the page's existing `notFound()`, and is inherently read-only (nothing to click that writes), so no `canReactivate` gating is needed.
- **Empty state:** `SkillConfidenceView` returns early when `trends.length === 0` (`:139`), but the spec wants the gentle note even with zero answers, so the section must render in that branch too.

## Changes

### 1. Trend data — `src/lib/confidence-trend.ts`
- `TrendGoalMet` gains `answerValues: string[]` (raw stored option values; `[]` when unanswered). Populate in `toTrendGoal`.

### 2. Pure logic — new `src/lib/confidence-patterns.ts` (Supabase-free, not `'use server'`; model: `confidence-celebrations.ts`)
- `computeWhatHelpedPatterns(trends: SkillTrend[])` → `{ answeredGoals: number; methods: { value, label, count, skills: { skillId, name, count }[] }[] }`.
  - Walk `[currentGoal, ...previousGoals]` of every trend; include only goals with `met?.answered` and non-empty `answerValues`.
  - Map values: the six named values to themselves; `other` and `own_plan` → a single `other` method; de-duplicate per goal so one goal counts once per method; ignore unknown values.
  - Labels from `WHAT_HELPED_OPTIONS` (current wording); "Other" label is plain "Other" (never the student's text).
  - Sort methods by count desc, ties by `WHAT_HELPED_OPTIONS` order ("Other" last); skills within a method by count desc, then name. Methods never named are omitted.
  - Skill names come from the trend (`SkillTrend.name`), so renames show automatically.

### 3. UI
- New `src/components/ui/WhatHelpedPatterns.tsx` (`{ trends }`): a `<section aria-labelledby>` titled "What tends to help you", `text-lg font-bold text-dark-text` like the other sections, neutral `rounded-xl border border-border bg-surface` cards (not the teal celebration styling).
  - Always-visible "how to read this" line: patterns from your own answers, what tends to go along with progress, not proof a method caused it, every student is different.
  - No answers → only the gentle note ("Patterns will show up here as you reach goals and log what helped"), never implying a shortfall.
  - With answers → "The following is based on N time(s) where you logged what helped. Note: you can pick…", plus a note that methods overlap so counts won't add up to the total. One `<ul>` row per method: a count tile (`aria-hidden`, decoration), the label, "Helped N times" as text, and the top 3 skills as text ("React 3, CSS 1"). **Changed after review:** the bar was dropped in favor of the count tile, and each skill is a small tag (name plus count, with an sr-only colon between them). Collapsed, a method's tags fill exactly one line — as many as fit, then a "+N more" tag as the last item (a `button` with `aria-expanded`; "Show fewer" when open, when all tags wrap). How many fit is measured: a zero-height, clipped, `aria-hidden` copy of the row is read for each tag's width, and recomputed with a `ResizeObserver` (falls back to 3 where there is no layout, e.g. tests; always at least 1). The clipping matters: an unclipped hidden row widened the whole page. Local pluralization helper (the one in `SkillConfidenceInstructorView.tsx` isn't exported; don't refactor it just for this).
  - No ranking words, no good/bad colors, no animation (the global reduced-motion rule already applies).
- `src/components/ui/SkillConfidenceView.tsx`: **added after review — two tabs**, "Skills" (default; the existing working-on and mastered sections) and "Patterns" (`<WhatHelpedPatterns>`), reusing the instructor page's tablist pattern (`role="tablist"`, arrow keys). The "What helped?" follow-up stays above the tabs so the bell's `#what-helped` link works on either tab — **changed after review:** as a one-line banner ("N reached goals are waiting for you to log what helped.") with a "Log what helped" button that opens a `Modal` listing the waiting goals, each with an "Answer" button that hands off to the existing answer dialog; the section keeps `id="what-helped"`. Tabs also show in the empty-state branch (Patterns tab shows the gentle note). Picked skills live in the view's state, so they survive switching tabs.

### 4. Docs
- One sentence on the patterns section in the Confidence Tracker v2 paragraph of `CLAUDE.md`.
- Save this plan to `_plans/confidence-pattern-insights.md`, link it from the roadmap's Phase 7 entry. Don't mark Phase 7 done until built and verified live.

## Tests (`./tests`, Vitest; follow existing conventions)
- New `tests/confidence-patterns.test.ts` (pure, no mocks, small local factories): grouping by method; multi-method goal counts once per method and its skill appears under each; per-skill counts; `own_plan` + `other` fold into one "Other" counted once per goal; unanswered goals, open goals and mastery contribute nothing; unnamed methods absent; ordering (count desc, stable ties, Other last); a single answer works (no minimum); zero answers → `answeredGoals: 0`, no methods; both mastery/reactivation cycles' goals counted; renamed skill uses current name.
- New `tests/WhatHelpedPatterns.test.tsx`: gentle note at zero answers; one answer shows "helped 1 time"; counts and skill breakdown as text; "based on N goals" and the reading-guide line always shown with results; no "best / most effective" wording; no inputs or buttons.
- Extend `tests/SkillConfidenceView.test.tsx`: section appears in the empty state (note) and with answered goals; still shown with `canReactivate={false}`; existing follow-up and reactivate tests unaffected.
- Update every inline `met: {…}` literal that now needs `answerValues` (grep `outcomeId:` in `tests/SkillConfidenceView.test.tsx`, `tests/confidence-trend.test.ts`, `tests/SkillConfidenceInstructorView.test.tsx`).

## Verification
1. `npm test`, `npm run lint` (existing repo-wide errors are known; check only new ones), `npm run build`.
2. Live check with `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED=true` in `.env.local` and `npm run dev` (browser preview), as the test student `zHaniyaStudent`. Local dev and production share one Supabase database, so this reads real rows and writes nothing new unless I answer a "what helped"; ask before answering or changing any data (follow the "live checks step by step" preference: narrate, log anything created).
   - Student with no answered goals → only the gentle note. With the existing Phase 6 test answers → counts, bars, per-skill breakdown match the stored rows (cross-check against the outcomes table).
   - Several methods on one goal → counted under each; "Other" write-in → grouped, text not shown.
   - Instructor per-student view → no section. Flag off → page 404 as before.
   - Check dark mode, high contrast, mobile width, keyboard/screen reader.
3. No new test data is created by default; if an answer is added for the check, list it and add it to the roadmap's pre-launch cleanup list (ask before deleting).
