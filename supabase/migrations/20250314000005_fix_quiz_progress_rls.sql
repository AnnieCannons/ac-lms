-- Fix overly permissive RLS on quiz_progress table
-- Old policy allowed any authenticated user to read/write/delete any row
-- New policies: students can only access their own rows; instructors/admins can read all

DROP POLICY IF EXISTS "access: authenticated" ON public.quiz_progress;

-- Students can manage their own progress only
CREATE POLICY "quiz_progress_own" ON public.quiz_progress
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Instructors and admins can read all quiz progress (for monitoring/grading)
CREATE POLICY "quiz_progress_staff_read" ON public.quiz_progress
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('instructor', 'admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.quizzes q
      JOIN public.course_enrollments ce ON ce.course_id = q.course_id
      WHERE q.id = quiz_progress.quiz_id
        AND ce.user_id = auth.uid()
        AND ce.role IN ('instructor', 'ta')
    )
  );
