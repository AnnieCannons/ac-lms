# Spec for confidence-pattern-insights

branch: claude/feature/confidence-pattern-insights

figma-component (if used): N/A

## Summary
This is Phase 7 of the larger confidence-tracking initiative (confidence-tracker-v2; see [`_plans/confidence-tracker-v2-roadmap.md`](../_plans/confidence-tracker-v2-roadmap.md)). Phase 6 ([PR #162](https://github.com/AnnieCannons/ac-lms/pull/162)) made students reaching a goal answer, optionally, "What helped you reach your goal?" and stores each answer against the one met goal and skill it belongs to. Phase 4 built the "My Skill Confidence" page showing a student's ratings, goals and history. Today those answers are only displayed one goal at a time; nobody can see the bigger picture of what tends to help a student.

This phase adds a new section to the existing "My Skill Confidence" page (not a new page) that gathers the student's own "what helped" answers across every skill and shows, by method (for example flashcards, TA or instructor help, outside tutorials), how many times each was named as helping, and for which skills. Each answered goal is a goal the student reached, so each time a method is named it is a time that method went along with the student's confidence reaching the goal they set. The section always shows what exists, even a single answer ("Flashcards helped 1 time"), and updates on its own as the student rates, reaches goals and answers more, so over time it shows which methods help most for which skills. It is for the student's own reflection: it is framed descriptively ("Patterns you've noticed"), never as proof that a method works, matching the app's non-prescriptive tone elsewhere.

This phase is student-facing only and adds no new data capture. It does not change when anything is asked, stored, celebrated or reminded. Showing these patterns to instructors and staff is a separate later phase (Phase 8 in the roadmap). Everything is behind the existing `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` flag, which is still off in production, stays off until every phase of the initiative is complete, and is not turned on without asking first.

## Functional Requirements

### Where it appears and when
- A new section on the student's "My Skill Confidence" page, titled in the spirit of "Patterns you've noticed". It is not a new page and not a new navigation item.
- There is no minimum. As soon as the student has one answered "what helped" goal, the section shows results from it.
- A student with no answered "what helped" yet (including one who has never reached a goal) still sees the section, with a short, friendly note that patterns will show up here as they reach goals and log what helped. The note never implies the student has fallen short.
- Only the owning student sees the section. It is gated behind `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED`: with the flag off the page is unreachable, as today, so nothing new appears.
- Instructors and staff do not see this section on a student's page in this phase. On their per-student view they continue to see each "what helped" answer read-only, exactly as in Phase 6. A way for instructors and staff to see a student's (and the class's) patterns is planned as Phase 8, not built here. Student Preview and Observer mode show the section for the account being viewed, accurately and read-only, with nothing that changes data.
- The section reflects the latest data every time the page loads, so a newly answered "what helped" appears the next time the page is viewed, with no action from the student.

### What it counts
- The source data is only the student's own answered "what helped" selections on met goals (Phase 6). Mastery celebrations never asked, so they contribute nothing. Unanswered met goals contribute nothing and are not counted as "no method."
- Answers are grouped by method using the same seven categories "what helped" offers: practicing on my own, reviewing the lesson materials, getting help from a TA or instructor, outside tutorials or videos, studying flashcards, reviewing class notes, and "Other."
- A student may choose several methods for one goal. Each chosen method is counted once for that goal, so one goal can count toward more than one method. The section makes clear that methods overlap, so the counts are not meant to add up to the number of goals.
- The student's own study-plan write-in that Phase 6 offers as an extra option, and any "Other" free text, are all grouped under a single "Other" entry and never listed individually, split by wording, merged by guesswork or interpreted.
- Goals met across all of the student's courses and all of their skills are included together, since skills and goals belong to the student, not a course.

### What it shows
- For each method that has at least one answer: how many times it was named as helping ("helped 4 times"), counting one per answered goal. No average rating change or other calculation is shown; the count is the measure.
- Under each method, which skills those times were on, with how many for each (for example "React 3, CSS 1"), so the student can see which methods help most for which skills. Skills are shown by their current name. Skills with no answered goal for that method are not listed.
- Methods are ordered by how many times they were named, most first, with a consistent, predictable order for ties. Methods never named are not shown, so the section is not a list of empty rows. "Other" appears only if it was used.
- The section shows how many answered goals it is based on, so the student can see how much evidence is behind it.
- Numbers are shown plainly with no rankings such as "best," "most effective," or "worst," no colors or icons implying good or bad, and no comparison to other students. A single answer is shown the same way as many, with no extra caution or warning.
- A short, always-visible line explains how to read it, in plain words: these are patterns from the student's own answers, they show what tends to go along with progress, not proof that a method caused it, and every student is different.

### Presentation
- A list of methods, each with its count as text and a simple bar beside it showing its count relative to the others, followed by its per-skill counts as text. The numbers are always shown as text, so the bar is never the only way to get the information.
- It does not rely on color alone, works at desktop and mobile widths, is keyboard and screen-reader accessible, and respects the app's existing light/dark and high-contrast theming.
- No celebration, kudos or animation is added. Any motion respects the reduced-motion preference.
- Method names use the same wording students saw when they chose them. For known methods the section shows the current wording.

### Cross-cutting
- No new data is captured, and nothing is written. The section is computed from what Phases 4 and 6 already store.
- Answers stay add-only as in Phase 6; this phase never edits, hides or removes an answer.
- Goals met and answered before this phase ships are included (they are Phase 6 data). Goals met before Phase 6 shipped have no "what helped" and contribute nothing, as before.
- If a skill is renamed, the section shows the new name. If a skill is deleted from the shared taxonomy, its goals and answers cascade away as in Phase 4, and the section simply recalculates without them.
- If a goal's assignment was soft-deleted or renamed, the section is unaffected, since it relies on answers and skills rather than assignment names.
- Nothing is read from or written to the old `confidence_skills`/`confidence_entries` tables or the `skill_tags` ("Level Up Your Skills") fields.
- Phases 2-6 behavior (rating capture, goals, mastery, reactivation, kudos, celebrations, follow-ups, reminders, trend pages, class overview) is unchanged.

## Figma Design Reference (only if referenced)
- Not applicable. No Figma file was provided. The section should follow the existing card and list visual language of "My Skill Confidence" and the app's theming, and read as a quiet, reflective addition rather than a celebratory or scoreboard-like one.

## Possible Edge Cases
- A student has no answered goals: the section shows only the gentle note.
- A student has exactly one answered goal: results show for it ("Flashcards helped 1 time"), with no ranking language, and grow as they answer more.
- Every answered goal named the same single method: that one method is shown with its count and skills, even though there is nothing to compare.
- A goal named several methods: it counts once toward each method, and its skill appears under each. The explanation makes the overlap clear so counts do not look like they should sum to the total number of goals.
- A student chose only "Other" with text on every answer: "Other" is the only entry, and the student's own text is not displayed.
- A student's own study-plan write-in was chosen as "what helped": it is grouped under "Other," never re-interpreted as one of the six named methods.
- A skill was mastered and reactivated, and goals were met in both cycles: both cycles' answered goals count, since each is its own met goal, and both appear under that skill.
- A skill was deleted: its goals and answers are gone, so they no longer count; a renamed skill shows its new name.
- An unanswered met goal later gets answered from the follow-up: the section updates on the next page load.
- The student answered some goals but skipped others: only answered ones count; skipped ones are neither shown nor treated as "nothing helped."
- The flag is turned off: the page is unreachable, so nothing about patterns is visible and no data changes.
- Student Preview or Observer viewing a student: shows the accurate section (or the gentle note) read-only and cannot change data.
- An instructor views the student's per-student view: sees no pattern section, only the read-only answers from Phase 6.
- A very large number of answered goals, many skills under one method, or a very long skill name: the section stays readable and does not break the layout.
- A student with many skills across several courses: all are combined into one view, and the figures are not scoped per course.

## Acceptance Criteria
- [ ] A new "Patterns you've noticed" section appears on the student's My Skill Confidence page (not a new page).
- [ ] With one or more answered "what helped" goals, results show immediately, with no minimum; with none, only a gentle note is shown, which never implies the student has fallen short.
- [ ] Answers are grouped by the seven fixed "what helped" methods; a goal naming several methods counts once toward each; the student's own write-ins and "Other" text are grouped under a single "Other" and never listed individually or reinterpreted.
- [ ] For each method that was named, the student sees how many times it was named (one per answered goal), a bar showing that count relative to the others, and the skills those times were on with a count per skill, alongside the total number of answered goals the section is based on.
- [ ] No average rating change or other calculated measure is shown.
- [ ] Unanswered met goals, mastery celebrations, goals met before Phase 6, and methods never named contribute nothing and are not shown.
- [ ] The section updates on its own as the student reaches and answers more goals, on the next page load.
- [ ] Wording is descriptive and non-causal, includes an always-visible explanation of how to read it, and uses no "best," "most effective," ranking, good-or-bad colors, or comparison to other students.
- [ ] The numbers are available as text, the presentation does not rely on color alone, and it works at desktop and mobile widths, with keyboard and screen-reader access and light/dark/high-contrast theming.
- [ ] The section shows only the owning student's own data, and is not visible to instructors or staff on their per-student view, which keeps showing answers read-only as in Phase 6.
- [ ] Student Preview and Observer show the accurate section read-only and cannot change any data.
- [ ] With `CONFIDENCE_TRACKER_V2_RATINGS_ENABLED` off, nothing new appears anywhere.
- [ ] Nothing is written or newly stored by this phase.
- [ ] Renamed skills, deleted skills, and renamed or soft-deleted assignments never cause errors.
- [ ] No behavior or data changes are observable in Phases 2-6, the old Confidence Tracker, or "Level Up Your Skills."

## Open Questions
<!--
When a question here gets answered (e.g. via an inline PR/file comment), do not delete or replace the question text.
Keep the original question and add the answer beneath it, like:
- <original question>
  - **Answer:** <answer>
This preserves a visible record of what was asked and decided, for anyone reading the spec later.
-->
- What is the minimum number of answered "what helped" goals before the section shows results? Too low gives misleading patterns; too high means most students never see it, since each answer needs a met goal. Recommendation: 3 answered goals, as the lowest number where "cited on 2 of 3" starts to mean anything, and revisit once there is real data.
  - **Answer:** no minimum. The section always shows results, even if a method was selected only once ("helped 1 time"), and as the student rates and answers more, the figures update and show which methods help most for which skills.
- Chart or list? A plain list of methods with counts and average rises is simplest and most accessible; a small bar chart shows relative frequency at a glance but adds a second thing to read. Recommendation: a list with a simple bar beside each count, with the numbers always shown as text.
  - **Answer:** recommendation accepted — a list with a simple bar beside each count, numbers always shown as text.
- How should "confidence increase associated with a method" be measured? The roadmap says "the average confidence increase associated with it." This spec assumes the change from the student's rating of the skill when the goal was set to the rating that met it. Confirm, or choose a simpler measure (for example the rating that met the goal minus the rating before it).
  - **Answer:** no rating change is calculated. Just show how many times each method increased confidence, based on how many times it was selected in the "what helped" question (each answered goal is one reached goal).
- Goals set later from My Skill Confidence (not at submission) have no rating given at that moment; which rating counts as the starting point: the student's latest rating of that skill at the time the goal was set? Recommendation: yes, the latest earlier rating of that skill at that time.
  - **Answer:** yes. (No longer needed, since no rating change is calculated; recorded as answered.)
- Should the study-plan "Other" write-ins and "what helped" "Other" text ever be listed individually (for example "Other: pair programming with a friend"), or always only grouped under "Other"? Listing them is more personal but makes the list long and invites reading meaning into free text. Recommendation: group under "Other" in the summary and show the student's exact text only in a per-goal drill-down, if one is built.
  - **Answer:** group under "Other."
- Should the student be able to click a method to see which goals it was named on (the drill-down described above), or is the summary enough for this phase? Recommendation: keep it out of this phase unless it is cheap, since each goal's answer is already visible in that skill's goal history.
  - **Question back:** "goal" here meant a specific reached goal (for example "your goal of 7 in React"), not the number or the skill alone. Since each method already lists the skills it helped on (see What it shows), this spec drops the click-through drill-down; the per-skill counts cover it, and each goal's answer is still visible in that skill's goal history. Confirm or change.
  - **Answer:** confirmed — drop the drill-down. The per-skill counts under each method are enough for this phase.
- Should the section also compare "planned" with "helped" (for example, "you planned flashcards on 5 goals, and flashcards helped on 3"), since the "what helped" list deliberately mirrors the study-plan list? The roadmap describes only counts and average rise for this phase. Recommendation: leave the planned-versus-helped comparison out, as a later idea.
  - **Answer:** keep it as a later idea (not in this phase).
- Should a student who has never reached a goal, or has fewer than the minimum answers, see a gentle "patterns will show up here" note, or nothing at all? A note teaches that the section exists; nothing at all avoids drawing attention to something they cannot yet use. Recommendation: show the note only once the student has at least one answered goal.
  - **Answer:** show the note even with 0 answered goals.
- Should instructors and staff eventually see these patterns for a student (for example on the By-student tab)? This spec assumes not in this phase, since it is framed as the student's own reflection. Confirm, or decide.
  - **Answer:** create Phase 8 for it. Not in this phase; added to the roadmap as Phase 8 (instructor and staff view of patterns).

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- Answers are grouped by method, and a goal naming more than one method counts once toward each of them, with each method's count and per-skill counts computed correctly from a small fixed data set.
- A single answered goal shows results (no minimum), and a student with no answered goals sees only the gentle note.
- Unanswered met goals, goals with no answer, and mastery contribute nothing, and methods never named do not appear.
- The study-plan write-in and "Other" text are grouped under a single "Other" and are never listed individually or split.
- Methods are ordered by how many times they were named, with a stable order for ties, and a single named method displays without ranking language.
- No average rating change or other calculated measure is shown.
- Wording is neutral: no "best," "most effective," ranking, or comparison, and the how-to-read-it explanation is always visible.
- The numbers are present as text (not only in a bar), and the section is accessible.
- The section is shown to the owning student, is accurate and read-only in Student Preview and Observer, is not shown on the instructor per-student view, and is not shown or reachable with the flag off.
- Nothing is written when the section is displayed, and a newly answered goal is included the next time the data is loaded.
- A renamed skill shows its new name, and a deleted skill and a soft-deleted assignment do not cause errors.
- Existing Phase 2-6 behavior (rating capture, goals, mastery, reactivation, kudos, celebrations, follow-ups, reminders, trend pages, class overview) is unchanged.
