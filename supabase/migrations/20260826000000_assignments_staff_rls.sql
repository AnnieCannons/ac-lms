-- Staff role parity fix, follow-up to 20260825000000_staff_role_parity_fixes.sql.
--
-- Reported bug: a staff-role colleague could see a course's Week/Day outline
-- but assignment rows were empty, and opening an assignment's edit page
-- silently redirected back to the assignments list. Root cause: the
-- `assignments` and `checklist_items` RLS policies still only recognize
-- role IN ('instructor', 'admin') (or a course_enrollments row) — the same
-- gap already fixed for rubric_templates/quiz_progress/extension_requests.
-- It only surfaced on a brand-new course because staff carry a legacy
-- 'instructor' course_enrollments row on older courses that happened to
-- satisfy the old policy's fallback check; new courses have no such row.
--
-- The assignment editor UI (AssignmentEditor.tsx) also writes directly to
-- `assignments` and `checklist_items` via the client-side (RLS-bound)
-- Supabase client, so both SELECT and write policies need the same fix or
-- staff can open an assignment but fail to save it.
--
-- These are additive policies (new names) rather than rewrites of the
-- existing ones: the current policies aren't tracked in a migration (set up
-- directly in the Supabase dashboard), and Postgres OR's multiple permissive
-- policies together for the same command, so adding a staff-inclusive policy
-- closes the gap without needing to know the exact existing predicate.

-- ----------------------------------------------------------------
-- assignments
-- ----------------------------------------------------------------
CREATE POLICY "staff_select_assignments" ON public.assignments
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "staff_update_assignments" ON public.assignments
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ----------------------------------------------------------------
-- checklist_items (read and edited directly from the assignment editor UI)
-- ----------------------------------------------------------------
CREATE POLICY "staff_select_checklist_items" ON public.checklist_items
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "staff_insert_checklist_items" ON public.checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_update_checklist_items" ON public.checklist_items
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "staff_delete_checklist_items" ON public.checklist_items
  FOR DELETE TO authenticated
  USING (public.is_staff());
