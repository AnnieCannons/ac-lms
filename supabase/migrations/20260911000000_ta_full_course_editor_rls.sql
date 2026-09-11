-- Give course-scoped TAs (course_enrollments.role = 'ta') the same CourseEditor
-- write access instructors have, instead of the read-only view they had before.
--
-- CourseEditor.tsx writes most module/day/resource/assignment/checklist_item/
-- quiz mutations directly from the client via the RLS-bound Supabase client
-- (addModule, updateModulePublished, addDay, resource/assignment reorder and
-- cross-day move, checklist item edits, quiz day-pin move, etc. -- see the
-- staff_* policies added in 20260826000000 through 20260831000002 for the
-- same gap when the 'staff' role was added). Flipping the app-layer
-- `readOnly` prop off for TAs (this ticket) is not enough on its own: without
-- a matching RLS policy these writes affect 0 rows with no visible error,
-- the client's optimistic UI update masks the failure, and the change
-- reverts on next page load -- the exact bug class in
-- feedback_staff_rls_audit_pattern.md, just for a different role.
--
-- Unlike `is_staff()`, TA is not a global users.role value -- it's a
-- per-course course_enrollments row -- so every check here is scoped to the
-- specific course a row belongs to, not just "is this user a TA anywhere."
-- These are additive policies (new names), same convention as the staff_*
-- migrations: Postgres OR's multiple permissive policies together for the
-- same command, so this closes the gap without touching the existing
-- (dashboard-managed, untracked) policies.

-- ----------------------------------------------------------------
-- Helper functions to resolve "is the caller a TA for the course this row
-- belongs to", one per join depth actually needed by the tables below.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_ta_for_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.course_enrollments
    WHERE user_id = auth.uid()
      AND course_id = p_course_id
      AND role = 'ta'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_ta_for_module(p_module_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_ta_for_course((SELECT course_id FROM public.modules WHERE id = p_module_id))
$$;

CREATE OR REPLACE FUNCTION public.is_ta_for_module_day(p_module_day_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_ta_for_module((SELECT module_id FROM public.module_days WHERE id = p_module_day_id))
$$;

CREATE OR REPLACE FUNCTION public.is_ta_for_assignment(p_assignment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_ta_for_module_day((SELECT module_day_id FROM public.assignments WHERE id = p_assignment_id))
$$;

-- ----------------------------------------------------------------
-- modules (addModule, updateModulePublished/Category/Title/WeekNumber, reorder)
-- ----------------------------------------------------------------
CREATE POLICY "ta_select_modules" ON public.modules
  FOR SELECT TO authenticated
  USING (public.is_ta_for_course(course_id));

CREATE POLICY "ta_insert_modules" ON public.modules
  FOR INSERT TO authenticated
  WITH CHECK (public.is_ta_for_course(course_id));

CREATE POLICY "ta_update_modules" ON public.modules
  FOR UPDATE TO authenticated
  USING (public.is_ta_for_course(course_id))
  WITH CHECK (public.is_ta_for_course(course_id));

-- ----------------------------------------------------------------
-- module_days (addDay, rename, reorder)
-- ----------------------------------------------------------------
CREATE POLICY "ta_select_module_days" ON public.module_days
  FOR SELECT TO authenticated
  USING (public.is_ta_for_module(module_id));

CREATE POLICY "ta_insert_module_days" ON public.module_days
  FOR INSERT TO authenticated
  WITH CHECK (public.is_ta_for_module(module_id));

CREATE POLICY "ta_update_module_days" ON public.module_days
  FOR UPDATE TO authenticated
  USING (public.is_ta_for_module(module_id))
  WITH CHECK (public.is_ta_for_module(module_id));

-- ----------------------------------------------------------------
-- resources (create, update/publish, reorder, cross-day move)
-- ----------------------------------------------------------------
CREATE POLICY "ta_select_resources" ON public.resources
  FOR SELECT TO authenticated
  USING (public.is_ta_for_module_day(module_day_id));

CREATE POLICY "ta_insert_resources" ON public.resources
  FOR INSERT TO authenticated
  WITH CHECK (public.is_ta_for_module_day(module_day_id));

CREATE POLICY "ta_update_resources" ON public.resources
  FOR UPDATE TO authenticated
  USING (public.is_ta_for_module_day(module_day_id))
  WITH CHECK (public.is_ta_for_module_day(module_day_id));

-- ----------------------------------------------------------------
-- assignments (create, reorder, cross-day/week move, publish/bonus toggle,
-- field edits) -- this is the operation the ticket was actually about
-- ----------------------------------------------------------------
CREATE POLICY "ta_select_assignments" ON public.assignments
  FOR SELECT TO authenticated
  USING (public.is_ta_for_module_day(module_day_id));

CREATE POLICY "ta_insert_assignments" ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_ta_for_module_day(module_day_id));

CREATE POLICY "ta_update_assignments" ON public.assignments
  FOR UPDATE TO authenticated
  USING (public.is_ta_for_module_day(module_day_id))
  WITH CHECK (public.is_ta_for_module_day(module_day_id));

-- ----------------------------------------------------------------
-- checklist_items (AssignmentEditor.tsx writes these directly; delete is a
-- real hard delete, not a soft-delete, so it needs its own policy too)
-- ----------------------------------------------------------------
CREATE POLICY "ta_select_checklist_items" ON public.checklist_items
  FOR SELECT TO authenticated
  USING (public.is_ta_for_assignment(assignment_id));

CREATE POLICY "ta_insert_checklist_items" ON public.checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_ta_for_assignment(assignment_id));

CREATE POLICY "ta_update_checklist_items" ON public.checklist_items
  FOR UPDATE TO authenticated
  USING (public.is_ta_for_assignment(assignment_id))
  WITH CHECK (public.is_ta_for_assignment(assignment_id));

CREATE POLICY "ta_delete_checklist_items" ON public.checklist_items
  FOR DELETE TO authenticated
  USING (public.is_ta_for_assignment(assignment_id));

-- ----------------------------------------------------------------
-- quizzes: CourseEditor's day-pin move (dragging a quiz to a different day)
-- writes module_title/day_title directly. The existing "write: staff only"
-- policy (20250311000000_security_advisor_fixes.sql) only covers is_staff(),
-- so this is a real, live gap for TAs today, not a defensive one.
-- ----------------------------------------------------------------
CREATE POLICY "ta_update_quizzes" ON public.quizzes
  FOR UPDATE TO authenticated
  USING (public.is_ta_for_course(course_id))
  WITH CHECK (public.is_ta_for_course(course_id));
