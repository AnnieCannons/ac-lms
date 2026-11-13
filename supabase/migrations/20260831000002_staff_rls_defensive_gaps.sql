-- Staff role parity fix, follow-up to 20260831000001_staff_rls_remaining_gaps.sql.
--
-- Found by running the pg_policies diagnostic query from that migration's
-- header against the live DB. Two tables came back still gated on
-- role IN ('instructor', 'admin') with no is_staff() policy:
--   - checklist_responses ("Instructors can manage checklist responses", ALL)
--   - submission_comments ("Instructors can manage submission comments", ALL)
--
-- Unlike the other gaps in this series, these are NOT currently live bugs:
-- every read/write to both tables in the app goes through the service-role
-- admin client (src/lib/grade-actions.ts, student/instructor assignment
-- pages, student-stats-actions.ts), which bypasses RLS entirely. This
-- migration closes them anyway, defensively, so a future client-side
-- (RLS-bound) write to either table doesn't silently hit the same
-- optimistic-update-reverts-on-refresh bug the rest of this series fixed.

DROP POLICY IF EXISTS "staff_all_checklist_responses" ON public.checklist_responses;
CREATE POLICY "staff_all_checklist_responses" ON public.checklist_responses
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff_all_submission_comments" ON public.submission_comments;
CREATE POLICY "staff_all_submission_comments" ON public.submission_comments
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());
