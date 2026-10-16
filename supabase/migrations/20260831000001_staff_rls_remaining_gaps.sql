-- Staff role parity fix, follow-up to 20260825000000, 20260826000000,
-- 20260828000000, and 20260831000000_modules_staff_rls.sql.
--
-- Prompted by: "are there any other places this might happen that we
-- missed?" after the modules-publish-reverts bug. Audited every client-side
-- (RLS-bound) write in the app (grep for `supabase.from(...).insert/update/
-- delete/upsert` in files using @/lib/supabase/client) against which tables
-- already have a staff_* policy migration. Two kinds of gaps found:
--
-- 1. Tables never patched at all (same blind spot `modules` had -- these
--    were set up directly in the Supabase dashboard, not tracked in any
--    migration, so they still only recognize role IN ('instructor', 'admin')):
--      - courses    (CourseNameEditor.tsx, SyllabusEditor.tsx, DeleteCourseButton.tsx)
--      - resources  (CourseEditor.tsx, AddResourceButton.tsx, DuplicatePopup.tsx, ResourceOutline.tsx)
--      - submissions (MarkGradedButton.tsx "Mark as Graded", SubmissionComment.tsx
--        instructor feedback -- distinct from the student_comment column/path)
--
-- 2. Tables patched for some operations but not others:
--      - rubric_templates: staff got SELECT/INSERT/DELETE on 2026-08-25 but
--        not UPDATE, which AssignmentEditor.tsx uses to edit an existing template.
--      - assignments: staff got SELECT/UPDATE on 2026-08-26 but not INSERT,
--        which blocks staff from creating a new assignment (AddAssignmentButton.tsx,
--        DuplicatePopup.tsx, CourseEditor.tsx addAssignment).
--
-- As before, these are additive policies (new names) rather than rewrites of
-- the existing ones -- Postgres OR's multiple permissive policies together
-- for the same command, so this closes the gap without needing to know the
-- exact existing predicate.

-- ----------------------------------------------------------------
-- courses
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "staff_update_courses" ON public.courses;
CREATE POLICY "staff_update_courses" ON public.courses
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff_delete_courses" ON public.courses;
CREATE POLICY "staff_delete_courses" ON public.courses
  FOR DELETE TO authenticated
  USING (public.is_staff());

-- ----------------------------------------------------------------
-- resources
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "staff_select_resources" ON public.resources;
CREATE POLICY "staff_select_resources" ON public.resources
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "staff_insert_resources" ON public.resources;
CREATE POLICY "staff_insert_resources" ON public.resources
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "staff_update_resources" ON public.resources;
CREATE POLICY "staff_update_resources" ON public.resources
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ----------------------------------------------------------------
-- submissions (instructor-side grading/comment writes only --
-- student-owned writes are unaffected by this additive policy)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "staff_update_submissions" ON public.submissions;
CREATE POLICY "staff_update_submissions" ON public.submissions
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ----------------------------------------------------------------
-- rubric_templates: fill the missing UPDATE
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "staff_update_rubric_templates" ON public.rubric_templates;
CREATE POLICY "staff_update_rubric_templates" ON public.rubric_templates
  FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ----------------------------------------------------------------
-- assignments: fill the missing INSERT
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "staff_insert_assignments" ON public.assignments;
CREATE POLICY "staff_insert_assignments" ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());
