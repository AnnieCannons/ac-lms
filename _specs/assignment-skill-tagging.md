# Spec for assignment-skill-tagging

branch: claude/feature/assignment-skill-tagging

figma-component (if used): N/A

## Summary
This is Phase 1 of a larger confidence-tracking initiative (working name: confidence-tracker-v2). This phase is purely a data foundation and instructor-facing tool: it introduces a canonical, shared list of "skills" and lets instructors tag any assignment with one or more skills from that list, creating new skills on the fly when needed. No student-facing behavior is introduced in this phase — later phases will use these tags to prompt students to rate their confidence on an assignment's tagged skills at submission time. This feature is fully separate from the existing Confidence Tracker (the `confidence_skills`/`confidence_entries` tables and their UI on `/student/confidence` and `/instructor/courses/[id]/confidence`), which is untouched and continues to work exactly as it does today.

## Functional Requirements
- A new, shared (not per-student, not per-course) list of skills exists that any assignment across any course can be tagged from.
- The Assignment Editor gains a "Skills" field where an instructor can tag the assignment with one or more skills.
- The Skills field behaves as a creatable, multi-select, type-to-filter combobox:
  - As the instructor types, matching existing skills are shown in a dropdown, filtered case-insensitively (e.g. typing "j" or "J" surfaces a skill named "JavaScript").
  - Clicking a suggestion, or pressing Enter while a suggestion is highlighted, adds that existing skill as a tag on the assignment.
  - Pressing Enter with typed text that doesn't match any existing skill creates a new skill (using the exact text as typed, preserving the instructor's casing for display) and adds it as a tag — the new skill becomes immediately available for other assignments to reuse.
  - An assignment can have any number of tagged skills, including zero.
  - Already-tagged skills are visually represented as removable tags/chips, consistent with tag-input patterns elsewhere in the app.
- Skill matching for both filtering and duplicate-detection normalizes case, internal whitespace, and punctuation: "js", "JS", "j.s.", and "j s" are all treated as the same skill — typing any such variant of an existing skill's name must match it in the dropdown rather than offering to create a near-duplicate.
- Skill tags are visible/editable both when creating a new assignment and when editing an existing one.
- Instructors can rename an existing skill directly from the tagging UI. Since skills are shared/canonical, a rename applies globally — the skill's new name is reflected everywhere it's tagged, across all assignments and courses, not just on the assignment being edited.
- This phase does not require any student-facing UI, notification, or behavior change — students should see no difference in the app as a result of this phase shipping.
- This phase does not touch, modify, or read from the existing `confidence_skills` or `confidence_entries` tables or their related components.
- No predefined skill list or bulk backfill of existing assignments is required for this phase — the skill list starts empty and grows organically as instructors tag assignments going forward.

## Figma Design Reference (only if referenced)
- Not applicable — no Figma file was provided for this feature. Visual style should match the existing Assignment Editor's design system and the existing tag/combobox conventions already used elsewhere in the instructor UI (e.g. the state-picker combobox in the Partner form).

## Possible Edge Cases
- Leading/trailing whitespace on a typed skill name (e.g. "React " vs "React") should not create a duplicate skill.
- An instructor types a skill name that matches an existing skill only after trimming/case-normalization, but with different internal spacing or punctuation (e.g. "Node JS" vs "Node.js" vs "Node  JS" with a double space) — exact-match behavior here should be decided by the person implementing if not explicitly covered, but at minimum case + leading/trailing whitespace must not create duplicates.
  - **Answer:** normalization should also collapse internal whitespace and punctuation differences, not just case (see the matching requirement above and the corresponding Open Question below).
- Two instructors independently create what they intend to be "the same" new skill at nearly the same time (e.g. both type "GraphQL" for the first time in two different browser tabs) — the system should not end up with two separate skill records with identical normalized names.
- An instructor removes all skill tags from an assignment that previously had some — the assignment should end up with zero tagged skills, and the skill itself should remain in the shared list for other assignments to use (removing a tag from one assignment must never delete the underlying skill).
- Very long skill names or a very large number of tags on one assignment should not visually break the Assignment Editor layout.
- Typing a skill name that is only whitespace, or an empty string, should not create a blank/empty skill.
- An instructor accidentally creates a skill with a typo — since there's no admin/merge UI in this phase, correcting this would currently require direct database access; acceptable for this phase, but worth being aware of as a known limitation (not a blocker).
  - **Answer:** not a limitation for this phase after all — instructors can rename/edit the skill directly from the same tagging UI (see the added Functional Requirement above). A typo is fixed by renaming the skill, which updates it everywhere it's used.

## Acceptance Criteria
- [ ] A shared, canonical skills list exists, independent of any single course, assignment, or student.
- [ ] The Assignment Editor has a Skills field supporting multiple tags per assignment.
- [ ] Typing in the Skills field filters existing skills case-insensitively and shows matches in a dropdown.
- [ ] Selecting a suggested skill (click or Enter) adds it as a tag without creating a duplicate.
- [ ] Pressing Enter on text with no matching existing skill creates a new skill immediately and adds it as a tag.
- [ ] "js" and "JS" (and any other casing variant) resolve to the same skill rather than creating separate records.
- [ ] Skill names that differ only in internal whitespace or punctuation (e.g. "Node JS" vs "Node.js") resolve to the same skill rather than creating separate records.
- [ ] Removing a tag from an assignment does not delete the skill from the shared list.
- [ ] An instructor can rename an existing skill from the tagging UI, and the new name is reflected on every assignment that skill is tagged on.
- [ ] TAs do not have access to the skill-tagging UI/field.
- [ ] Tagged skills persist correctly when editing and re-opening an assignment.
- [ ] No changes in behavior, data, or UI are observable in the existing Confidence Tracker (`/student/confidence`, `/instructor/courses/[id]/confidence`) as a result of this work.
- [ ] No student-facing page or flow changes as a result of this phase.

## Open Questions
<!--
When a question here gets answered (e.g. via an inline PR/file comment), do not delete or replace the question text.
Keep the original question and add the answer beneath it, like:
- <original question>
  - **Answer:** <answer>
This preserves a visible record of what was asked and decided, for anyone reading the spec later.
-->
- Should the exact-match/duplicate check normalize only case, or also collapse internal whitespace and punctuation differences (e.g. "Node.js" vs "Node js")?
  - **Answer:** also collapse internal whitespace and punctuation differences
- Is there any need to see/manage the full shared skill list independent of an assignment (e.g. a simple admin list view to rename or merge accidentally-duplicated skills), or is that out of scope until a future phase?
  - **Answer:** out of scope for now (per-assignment rename from the tagging UI covers the typo-correction case for this phase; a standalone admin list view is not needed yet)
- Should skill tagging be restricted to instructors/admins only, or should TAs (who have grading access but not full content-editing rights on some other instructor pages) also be able to tag skills on assignments?
  - **Answer:** TAs don't need skill tagging access

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- Typing a partial skill name filters the suggestion list case-insensitively.
- Selecting an existing skill from the dropdown adds it as a tag and does not create a duplicate record.
- Pressing Enter on unmatched text creates a new skill and adds it as a tag.
- Typing an existing skill name with different casing (e.g. "js" when "JS" already exists) matches the existing skill rather than creating a new one.
- Typing an existing skill name with different internal whitespace/punctuation (e.g. "Node.js" when "Node JS" already exists) matches the existing skill rather than creating a new one.
- Removing a tag from an assignment does not delete the skill record itself.
- Renaming a skill from the tagging UI updates its name everywhere it's tagged, not just on the assignment being edited.
- Saving and re-opening an assignment preserves its tagged skills.
