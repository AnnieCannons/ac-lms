# Spec for confidence-instructor-patterns

branch: claude/feature/confidence-instructor-patterns

figma-component (if used): N/A

## Summary
This is Phase 8 of the larger confidence-tracking initiative (confidence-tracker-v2; see [`_plans/confidence-tracker-v2-roadmap.md`](../_plans/confidence-tracker-v2-roadmap.md)). Phase 6 ([PR #162](https://github.com/AnnieCannons/ac-lms/pull/162)) lets a student who reaches a goal answer, optionally, "What helped you reach your goal?". Phase 7 ([PR #164](https://github.com/AnnieCannons/ac-lms/pull/164)) added a "Patterns" tab to the student's own My Skill Confidence page ("What tends to help you"), counting by method how many times each was named and for which skills. Phase 7 deliberately showed this only to the student, and deferred the question of whether instructors and staff should see it to this phase. Today an instructor can see each "what helped" answer one goal at a time on the per-student view of the instructor Skill Confidence page, but has no way to see the bigger picture for a student or for the class.

This phase gives admins, instructors and staff a read-only view of "what helped" patterns on the instructor Skill Confidence page of a course, in two places: (1) per student, the same method-by-skill counts the student sees on their own Patterns tab, and (2) for the class as a whole, which methods students say helped and on which skills. Its purpose is to help staff understand which supports tend to go along with students reaching their goals (for example, whether TA help or flashcards are named often for a particular skill), and to know where students are not yet logging answers.

Like Phase 7, it is descriptive and never causal: counts of what students said helped, not proof that a method works, with no ranking of students, no scores, and no judgment of a student who has logged nothing. It adds no new data capture and changes nothing about when anything is asked, stored, celebrated or reminded. Everything is behind the existing `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` flag, which is still off in production, stays off until every phase of the initiative is complete, and is not turned on without asking first.

## Functional Requirements

### Who can see it
- Admin, instructor and staff only, matching the rest of the instructor Skill Confidence page. TAs, students and unauthenticated users cannot reach it or its data, verified on the server on every request, since the view reads across students.
- Read-only. Nothing on it answers, edits or changes anything on a student's behalf, and "what helped" answers stay add-only and student-only.
- Gated behind `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED`: with the flag off the instructor page is unreachable, as today, so nothing new appears.
- The student's own Patterns tab is unchanged.

### Per-student patterns
- In a student's expanded view on the By student tab, instructors and staff see that student's "what helped" patterns: for each method named, how many times it was named (one per answered goal), and which skills those times were on with a count per skill, plus how many answered goals it is based on.
- It uses the same rules as the student's own tab: methods are grouped by the seven fixed categories; a goal that named several methods counts once toward each; the student's own study-plan write-in and any "Other" text are folded into a single "Other" and the student's text is never shown here; unanswered met goals, mastery celebrations and goals met before Phase 6 contribute nothing; methods never named are not shown; ordering is by count, most first, with a predictable order for ties.
- The per-student patterns cover all of that student's skills and courses, the same as their own tab. (Whether staff should see only this course's skills is an open question below.)
- A student with no answered "what helped" shows a neutral "Nothing logged yet" style note, never anything implying the student has fallen short. Unanswered met goals continue to show as "Not answered yet" in the goal history exactly as in Phase 6.
- The individual answers shown read-only in each skill's goal history (Phase 6) are unchanged, and still show the student's exact "Other" text there.
- The same descriptive reading guide as on the student's tab is always visible with the patterns (patterns from the student's own answers, not proof a method caused progress, every student is different).

### Class-level patterns
- On the instructor page a class-level view shows, across the course's currently active students, how many times each method was named as helping and on which skills, with the number of answered goals and the number of students it is based on. (Where it appears, and whether it is a third tab or part of the Class overview, is an open question below.)
- It counts only the course's currently active students, matching the gradebook and the existing class overview, and excludes students who have left the course. (Whether it is limited to skills tagged on this course is an open question below.)
- Counts are plain totals: methods ordered by how many times they were named, with per-skill counts as tags, the same collapsed "+N more" behavior as the student's tab, and a count tile per method. Methods never named are not shown; "Other" appears only if used and never lists any free text.
- Anonymity within the class view: it never names or links individual students (staff already have the per-student view for that), and it never shows free-text answers.
- It shows how many students have logged at least one "what helped" out of the course's active students who have reached a goal (or otherwise how many students it is based on), so staff can see how much evidence is behind it. A class with no answers yet shows a neutral note.
- It follows the same non-causal framing: no "best", "most effective", "worst", rankings, good-or-bad colors, comparison between students, or comparison between courses.
- It can be narrowed by skill, using the same skill filter as the rest of the page; its student filter behavior is an open question below.

### Presentation
- Reuses the look and wording of the student's Patterns tab so staff and students see the same thing described the same way, adapted only where needed ("this student" or "students" instead of "you").
- Numbers are always available as text, nothing relies on color alone, it works at desktop and mobile widths, is keyboard and screen-reader accessible, and respects the app's light/dark and high-contrast theming. No celebration, kudos or animation is added; any motion respects the reduced-motion preference.
- It stays readable with many methods, many skills, very long skill names, or a large class.

### Cross-cutting
- No new data is captured and nothing is written; the view only reads what Phases 4 and 6 already store.
- Goals met across all of the student's courses and skills are not mixed into the class-level view beyond what the open questions below decide.
- If a skill is renamed, the new name is shown; if a skill is deleted, its goals and answers have cascaded away and the view recalculates without them; a renamed or soft-deleted assignment has no effect.
- The existing class overview figures (average, median, distribution, students rated) are unchanged, as is every behavior from Phases 2-7, the old Confidence Tracker, and "Level Up Your Skills."
- Nothing is read from or written to the old `confidence_skills`/`confidence_entries` tables or the `skill_tags` fields.

## Figma Design Reference (only if referenced)
- Not applicable. No Figma file was provided. Follow the existing instructor Skill Confidence page's cards, tabs and theming, and the visual language of the student's Patterns tab.

## Possible Edge Cases
- A student has no answered "what helped": their per-student patterns show only the neutral note; their unanswered goals still show "Not answered yet" in goal history.
- A student has exactly one answered goal: shown with the same plain wording as many ("helped 1 time"), no extra caution.
- A class where nobody has answered yet: the class-level view shows the neutral note only.
- A class where only one student has answered: the class-level view still shows results, and because it never names students, the "students it is based on" count is the only hint; whether a very small number should be protected is an open question below.
- A goal named several methods: counted once toward each; the reading note makes the overlap clear so counts do not look like they should add up to the number of goals.
- Every student chose only "Other": "Other" is the only entry and no free text appears in the class view.
- A student left the course: not counted in the class-level view; their own page is unaffected.
- A student's patterns include skills from other courses: shown or excluded according to the open question below, and consistent with the earlier-course context rule from Phase 4.
- A skill is renamed or deleted: new name shown, or removed from the counts, with no error.
- An instructor narrows the page to one skill: the class-level view recalculates for that skill only.
- A TA, student or unauthenticated user requests the page: rejected as today.
- The flag is turned off: the page is unreachable and nothing about patterns is visible.
- A large course with many students and skills: still usable and not unusably slow.

## Acceptance Criteria
- [ ] Admin, instructor and staff see a per-student patterns section in a student's expanded view on the By student tab, with the same method counts, per-skill counts and answered-goal total as that student's own Patterns tab (subject to the scope decision in the open questions).
- [ ] Admin, instructor and staff see a class-level view of which methods were named as helping and on which skills, across the course's currently active students.
- [ ] TAs, students and unauthenticated users cannot see either view or its data; this is enforced on the server.
- [ ] Both views are read-only and add, edit or hide nothing; answers remain student-only and add-only.
- [ ] Methods are grouped by the seven fixed categories; a goal naming several methods counts once toward each; own study-plan write-ins and "Other" text fold into one "Other" and are never shown as text in either view.
- [ ] Unanswered met goals, mastery celebrations, goals met before Phase 6, and methods never named contribute nothing and are not shown.
- [ ] The class-level view never names, links or identifies individual students, and shows how much evidence it rests on.
- [ ] A student or class with no answers shows only a neutral note that never implies a shortfall.
- [ ] Wording is descriptive and non-causal with an always-visible reading guide; no "best", "most effective", rankings, good-or-bad colors, or comparisons between students or courses.
- [ ] The class-level view excludes students no longer active in the course and responds to the page's skill filter.
- [ ] Numbers are available as text; both views work at desktop and mobile widths, are keyboard and screen-reader accessible, and respect light/dark/high-contrast theming.
- [ ] With `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` off, nothing new appears anywhere and the page is unreachable as today.
- [ ] Nothing is written or newly stored by this phase.
- [ ] Renamed or deleted skills and renamed or soft-deleted assignments never cause errors.
- [ ] The student's own Patterns tab, the existing class overview, and all Phase 2-7 behavior, the old Confidence Tracker and "Level Up Your Skills" are unchanged.

## Open Questions
<!--
When a question here gets answered (e.g. via an inline PR/file comment), do not delete or replace the question text.
Keep the original question and add the answer beneath it, like:
- <original question>
  - **Answer:** <answer>
This preserves a visible record of what was asked and decided, for anyone reading the spec later.
-->
- Should this phase include a class-level view at all, or only the per-student view? The roadmap says "possibly a class-level view." The per-student view reuses what already exists; the class-level view is new aggregation and a new place on the page. Recommendation: include both, since the class-level view is where staff learn which supports are working across a group.
  - **Answer:** include both (per-student and class-level views).
- Where should the class-level view appear: as a third tab on the instructor page (for example "Patterns"), or inside the existing Class overview tab alongside the per-skill cards? Recommendation: a third tab, so the Class overview stays focused on ratings and the new view has room.
  - **Answer:** a third tab on the instructor page.
- Should the per-student patterns include goals on all of the student's skills and courses (as on their own tab), or only skills tagged on this course? Phase 4 limited instructors' earlier-course context to skills tagged on the current course. Recommendation: limit to skills tagged on this course, matching that rule and avoiding showing an instructor answers about unrelated skills.
  - **Answer:** recommendation accepted — limit to skills tagged on this course.
- Should the class-level view count only skills tagged on this course and only goals met in this course, or all goals those students have answered on this course's skills? Recommendation: this course's tagged skills, counting each active student's answered goals on those skills, matching how the class overview is scoped to the course's tagged skills.
  - **Answer:** recommendation accepted — this course's tagged skills, counting each active student's answered goals on those skills.
- Should the class-level view protect small groups, for example hiding or merging per-skill counts when fewer than a few students contributed, so one student's answers cannot be inferred? The class view never names students, but in a small class or on a rarely-rated skill the counts could point to one person, and staff can already see each student's answers individually in the per-student view. Recommendation: no minimum (consistent with Phases 4 and 7), show the number of students it is based on.
  - **Answer:** recommendation accepted — no minimum; show the number of students it is based on.
- Should the class-level view show the number of students who logged at least one answer out of the course's active students, so staff can see how many have not logged anything? This helps staff know where evidence is thin, but could read as ranking students who did not answer. Recommendation: show only the count of students and answered goals it is based on, not a "not yet logged" count.
  - **Answer:** recommendation accepted — show only the count of students and answered goals it is based on, not a "not yet logged" count.
- Should the page's student filter affect the class-level view (narrowing it to one student, which would duplicate the per-student view), or should the class-level view ignore it? Recommendation: ignore the student filter on the class-level view; it always shows the whole class, narrowed only by skill.
  - **Answer:** recommendation accepted — ignore the student filter on the class-level view; it always shows the whole class, narrowed only by skill.
- Should the "needs attention" count on the Class overview (an idea noted in the roadmap) be part of this phase, since the roadmap pairs the two ideas? Recommendation: no; keep it as a separate later idea.
  - **Answer:** keep it as a separate later idea (not in this phase).
- Should the per-student patterns include, beside each method, the instructor's ability to open the goals it was named on? Recommendation: no drill-down, as in Phase 7; each goal's answer is already visible in that skill's goal history.
  - **Answer:** recommendation accepted — no drill-down.

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- Per-student patterns for a small fixed data set: counts by method, per-skill counts, answered-goal total, a goal naming several methods counting once toward each, and own write-ins and "Other" folded into one "Other" with no free text shown.
- Unanswered met goals, mastery, goals with no answer, and methods never named contribute nothing and do not appear; a student with no answers shows only the neutral note.
- Class-level counts are computed correctly across several students from a small fixed data set, ordered by count with a stable order for ties, and never name or identify a student.
- The class-level view includes only currently active students and (per the decided scope) only the relevant skills and goals, and narrows correctly with the skill filter.
- The class-level view shows how many students and answered goals it is based on, and a class with no answers shows only the neutral note.
- Wording is neutral (no "best", "most effective", ranking or comparison) and the reading guide is always visible; numbers are present as text.
- The collapsed "+N more" skill tags behave as on the student's Patterns tab.
- Admin, instructor and staff can see both views; TAs, students and unauthenticated users cannot, and with the flag off the page is unreachable.
- Both views are read-only (no answer, edit or set-goal controls), and nothing is written when they are displayed.
- A renamed skill shows its new name, and a deleted skill and a soft-deleted assignment do not cause errors.
- The student's own Patterns tab, the existing class overview figures and existing Phase 2-7 behavior are unchanged.
