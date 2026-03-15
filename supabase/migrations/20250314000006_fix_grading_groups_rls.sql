-- Fix grading_groups RLS: scope to course enrollment instead of global instructor role
-- Old policy: any global instructor/admin could manage any course's grading groups
-- New policy: must be enrolled as instructor/admin in the specific course

DROP POLICY IF EXISTS "Instructors can manage grading groups" ON public.grading_groups;

CREATE POLICY "Instructors can manage grading groups"
  ON public.grading_groups
  FOR ALL TO authenticated
  USING (
    -- Admins can manage all
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    -- Instructors enrolled in this specific course
    EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.course_id = grading_groups.course_id
        AND ce.user_id = auth.uid()
        AND ce.role = 'instructor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.course_id = grading_groups.course_id
        AND ce.user_id = auth.uid()
        AND ce.role = 'instructor'
    )
  );
