# Instructor & Staff Patterns (confidence-tracker-v2, Phase 8)

## Context
Phase 7 gave students a "What tends to help you" Patterns tab. Staff can only see each "what helped" answer one goal at a time. Phase 8 (spec: `_specs/confidence-instructor-patterns.md`, branch `claude/feature/confidence-instructor-patterns`) adds, read-only on the instructor Skill Confidence page: (1) per-student patterns inside a student's expanded By-student row, and (2) a class-level third tab "Patterns". No migration, no new query, nothing stored, behind `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` (stays off; never turn on without asking).

## Findings that shape the design
- **Data is already there.** `loadCourseTrend` (`src/lib/confidence-trend-data.ts`) loads goal outcomes for the roster × tagged skills, and each student's `SkillTrend[]` already carries `met.answered` / `met.answerValues` on `currentGoal` and `previousGoals`. Roster = active students only; skills = this course's tagged skills (what the spec decided). Staff already pass RLS on `confidence_tracker_goal_outcomes`. Page access (flag, admin/instructor/staff, TA redirect) is already enforced in `skill-confidence/page.tsx`, so no access change.
- **`computeWhatHelpedPatterns(trends)` (`src/lib/confidence-patterns.ts`) is reusable as-is** for one student, and for the class by passing every student's trends flattened (it sums by skill id). Only missing piece: a count of students the class figures rest on.
- **Free text must never be used.** Aggregate from `answerValues` only, never `answerLabels` (which holds the student's own text). Goal history on the cards continues to show exact text, as in Phase 6.
- **Skill filter is client state** in `SkillConfidenceInstructorView.tsx`, so class counts are computed client-side from `students[].trends` after the skill filter. The student filter lives only in the By-student panel and is simply not applied to the Patterns tab.
- **`WhatHelpedPatterns.tsx` is student-worded and has hard-coded ids** (`id="patterns"`, `patterns-heading`): "you", "your own answers", fixed heading. Rendering it once per expanded student would duplicate ids.
- **Tab handling is two-tab only** (`onTabKeyDown`, lines ~160-166, toggles overview/students). A third tab needs index-based wrap-around.

## Changes

### 1. Pure logic — `src/lib/confidence-patterns.ts`
- Add `computeClassPatterns(studentsTrends: SkillTrend[][])` → `WhatHelpedPatterns & { answeredStudents: number }`: runs `computeWhatHelpedPatterns` over the flattened trends; `answeredStudents` = students whose own result has `answeredGoals > 0`. Never returns student ids/names.
- Leave `computeWhatHelpedPatterns` unchanged (student tab untouched).

### 2. Component — `src/components/ui/WhatHelpedPatterns.tsx`
- Keep the existing student usage and wording unchanged by default. Add an optional `audience` prop (`'self' | 'student' | 'class'`, default `'self'`) selecting the copy: heading, reading guide ("patterns from this student's / students' own answers … not proof a method caused it"), neutral empty note ("Nothing logged yet" style, no shortfall wording), "based on N answered goals" (class adds "from M students"), overlap note.
- Optional `patterns` input (precomputed) so the class view can pass `computeClassPatterns` output; otherwise it computes from `trends` as today.
- Replace hard-coded ids with `useId()` so several instances can coexist; keep the student tab's `#patterns` behavior working.
- Reuse the existing `MethodSkills` tag measurement and "+N more / Show fewer" untouched; per-student section can omit the big heading (`compact`) to fit inside a row.

### 3. Instructor view — `src/components/ui/SkillConfidenceInstructorView.tsx`
- `Tab` becomes `'overview' | 'students' | 'patterns'`; generalize `onTabKeyDown` to Arrow left/right (wrap), plus Home/End; add the third tab button/panel with matching `aria-controls`/`aria-labelledby`.
- Patterns panel: shares the existing skill filter, ignores the student filter; computes `computeClassPatterns` over each student's skill-filtered trends; renders `WhatHelpedPatterns audience="class"`. No student names, links or free text.
- `StudentRow`: when expanded, render `WhatHelpedPatterns audience="student" compact` above the existing `SkillTrendCard`s using the row's already skill-filtered `trends`. Students with no ratings keep today's non-expandable "No ratings yet" row.
- Update the page intro copy in `skill-confidence/page.tsx` (lines ~48-50) only if needed to mention patterns.

### 4. Docs
- One sentence in the Confidence Tracker v2 paragraph of `CLAUDE.md`; roadmap Phase 8 entry gets a Plan link (don't mark done until built and verified live).

## Tests (`./tests`, Vitest)
- `tests/confidence-patterns.test.ts`: class totals across several students from a small fixed set; ordering/ties; own_plan + other fold; `answeredStudents`; unanswered/open/mastery contribute nothing; skill-filtered input narrows counts; no student identity in output.
- `tests/WhatHelpedPatterns.test.tsx`: `audience` copy for student/class (neutral note at zero, "based on N goals" and student count, reading guide always visible, no best/ranking words, no free text, no buttons beyond the "+N more" toggle); unique ids with several instances.
- `tests/SkillConfidenceInstructorView.test.tsx`: update the tab-label assertion and keyboard test for three tabs; Patterns tab shows class counts, ignores the student filter, responds to the skill filter, shows no student names, empty note; expanded student shows their patterns (scope with `within` to avoid duplicate text matches); read-only (no answer/set-goal/reactivate controls).
- Existing Phase 2-7 tests unchanged apart from the above. (No tests exist for the page access check; covered in live verification.)

## Verification
1. `npm test`, `npm run lint` (only new errors), `npm run build`.
2. Live with `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED=true` in `.env.local` and `npm run dev`, as an instructor/staff user, reading existing Phase 6/7 test answers only (shared DB; write nothing; ask before creating or changing data):
   - Third tab appears; keyboard arrows/Home/End work; class counts match the stored outcomes for the roster; skill filter narrows; student filter has no effect.
   - Expand a student → per-student patterns match their own Patterns tab restricted to this course's tagged skills; student with no answers shows the neutral note.
   - Student's own Patterns tab unchanged; TA/student cannot open the page; flag off → page 404.
   - Dark mode, high contrast, mobile width, keyboard/screen reader.
3. No new test data is created; if any is, list it, add it to the roadmap's pre-launch cleanup list, and ask before deleting.
