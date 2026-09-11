-- Follow-up to 20260911000000_ta_full_course_editor_rls.sql: extends TA edit
-- access to the course Info page (GeneralInfoEditor.tsx), which was left
-- read-only in that first pass.
--
-- GeneralInfoEditor.tsx writes directly to `course_sections` via the
-- client-side (RLS-bound) Supabase client (reorder/update/delete/publish-
-- toggle of a section). The existing policy is "write: staff only"
-- (20250311000000_security_advisor_fixes.sql, backed by is_staff()) --
-- course-scoped TA is not covered, so without this, TA writes here would
-- hit the same silent 0-rows-affected failure as the other tables.
--
-- SELECT already works for TA (the existing "read: enrolled or staff" policy
-- grants read to any user with a course_enrollments row, TA included), so
-- only a write policy is needed.
--
-- Note: the course Info page's PaidLearnersToggle (which writes to
-- `courses.paid_learners`) intentionally stays instructor/admin-only, same
-- as course dates -- this migration only covers `course_sections`.

CREATE POLICY "ta_all_course_sections" ON public.course_sections
  FOR ALL TO authenticated
  USING (public.is_ta_for_course(course_id))
  WITH CHECK (public.is_ta_for_course(course_id));
