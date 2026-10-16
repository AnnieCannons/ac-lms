-- Staff role parity fix, follow-up to 20260825000000_staff_role_parity_fixes.sql,
-- 20260826000000_assignments_staff_rls.sql, and 20260828000000_module_days_staff_rls.sql.
--
-- Reported bug: a staff-role instructor clicked "Publish" on a module (and
-- separately, adding a new module) in CourseEditor.tsx -- the UI showed
-- "Published" immediately but reverted to "Draft" on refresh. Root cause:
-- unlike module_days/assignments/checklist_items, the `modules` table's RLS
-- policies were never patched for the staff role. CourseEditor's addModule/
-- updateModulePublished/updateModuleCategory/updateModuleTitle/
-- updateModuleWeekNumber/reorderModules all write directly to `modules` via
-- the client-side (RLS-bound) Supabase client, so the old policy's
-- `role IN ('instructor', 'admin')` check silently filtered out the staff
-- user's row -- the UPDATE affected 0 rows with no error, so the client's
-- optimistic local state update masked the failure until the next page load
-- re-fetched the real (unchanged) DB row.
--
-- These are additive policies (new names) rather than rewrites of the
-- existing ones: the current policies aren't tracked in a migration (set up
-- directly in the Supabase dashboard), and Postgres OR's multiple permissive
-- policies together for the same command, so adding a staff-inclusive policy
-- closes the gap without needing to know the exact existing predicate.

DROP POLICY IF EXISTS "staff_select_modules" ON public.modules;
CREATE POLICY "staff_select_modules" ON public.modules
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "staff_insert_modules" ON public.modules;
CREATE POLICY "staff_insert_modules" ON public.modules
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff_update_modules" ON public.modules;
CREATE POLICY "staff_update_modules" ON public.modules
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());
