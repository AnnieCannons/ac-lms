-- Staff role parity fix, follow-up to 20260825000000_staff_role_parity_fixes.sql
-- and 20260826000000_assignments_staff_rls.sql.
--
-- Reported bug: a staff-role instructor could load a course's Week/Day outline
-- (fetched server-side via the service-role client in page.tsx, which bypasses
-- RLS) but adding, renaming, or reordering a day failed with a 403 -- those
-- writes go through CourseEditor.tsx's client-side (RLS-bound) Supabase client
-- (see addDay/renameDay/reorderDay in src/components/layout/CourseEditor.tsx).
-- Root cause: module_days' RLS policies still only recognize
-- role IN ('instructor', 'admin') (or a legacy course_enrollments row) --
-- the same gap already fixed for rubric_templates/quiz_progress/
-- extension_requests/assignments/checklist_items.
--
-- These are additive policies (new names) rather than rewrites of the
-- existing ones: the current policies aren't tracked in a migration (set up
-- directly in the Supabase dashboard), and Postgres OR's multiple permissive
-- policies together for the same command, so adding a staff-inclusive policy
-- closes the gap without needing to know the exact existing predicate.

CREATE POLICY "staff_insert_module_days" ON public.module_days
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_update_module_days" ON public.module_days
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_select_module_days" ON public.module_days
  FOR SELECT TO authenticated
  USING (public.is_staff());
