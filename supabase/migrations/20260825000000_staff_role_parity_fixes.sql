-- Staff role parity fixes.
-- The 'staff' role was added to users.role after several RLS policies and
-- one SQL function were already checking role IN ('instructor', 'admin').
-- Those checks were never updated, so staff members (which is what all
-- former instructors were migrated to) are silently rejected at the
-- database level even when application code allows them through.

-- ----------------------------------------------------------------
-- is_staff() — backs write policies on global_content, calendar_cohorts,
-- calendar_breaks, course_sections, calendar_holidays, and quizzes.
-- Fixing this one function fixes all of those policies at once.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('instructor', 'admin', 'staff')
  )
$$;


-- ----------------------------------------------------------------
-- rubric_templates
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Instructors can read rubric templates" ON rubric_templates;
CREATE POLICY "Instructors can read rubric templates"
  ON rubric_templates for select
  using (
    exists (
      select 1 from users where id = auth.uid() and role in ('instructor', 'admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "Instructors can insert rubric templates" ON rubric_templates;
CREATE POLICY "Instructors can insert rubric templates"
  ON rubric_templates for insert
  with check (
    exists (
      select 1 from users where id = auth.uid() and role in ('instructor', 'admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "Instructors can delete rubric templates" ON rubric_templates;
CREATE POLICY "Instructors can delete rubric templates"
  ON rubric_templates for delete
  using (
    exists (
      select 1 from users where id = auth.uid() and role in ('instructor', 'admin', 'staff')
    )
  );


-- ----------------------------------------------------------------
-- quiz_progress_staff_read
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "quiz_progress_staff_read" ON public.quiz_progress;
CREATE POLICY "quiz_progress_staff_read" ON public.quiz_progress
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('instructor', 'admin', 'staff')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.course_enrollments ce ON ce.course_id = q.course_id
      WHERE q.id = quiz_progress.quiz_id
        AND ce.user_id = auth.uid()
        AND ce.role IN ('instructor', 'ta', 'staff')
    )
  );


-- ----------------------------------------------------------------
-- extension_requests
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "instructors_select_extension_requests" ON extension_requests;
CREATE POLICY "instructors_select_extension_requests"
  ON extension_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('instructor', 'admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "instructors_update_extension_requests" ON extension_requests;
CREATE POLICY "instructors_update_extension_requests"
  ON extension_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('instructor', 'admin', 'staff')
    )
  );
