-- Security Advisor fixes
-- Run in Supabase SQL Editor.
-- After running, enable Leaked Password Protection manually:
--   Authentication → Settings → Leaked Password Protection → ON

-- ----------------------------------------------------------------
-- Reusable check: is the current user an instructor or admin?
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
      AND role IN ('instructor', 'admin')
  )
$$;


-- ----------------------------------------------------------------
-- 1. global_content
-- ----------------------------------------------------------------
ALTER TABLE public.global_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read: authenticated"  ON public.global_content FOR SELECT TO authenticated USING (true);
CREATE POLICY "write: staff only"    ON public.global_content FOR ALL    TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


-- ----------------------------------------------------------------
-- 2. calendar_cohorts
-- ----------------------------------------------------------------
ALTER TABLE public.calendar_cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read: authenticated"  ON public.calendar_cohorts FOR SELECT TO authenticated USING (true);
CREATE POLICY "write: staff only"    ON public.calendar_cohorts FOR ALL    TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


-- ----------------------------------------------------------------
-- 3. calendar_breaks
-- ----------------------------------------------------------------
ALTER TABLE public.calendar_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read: authenticated"  ON public.calendar_breaks FOR SELECT TO authenticated USING (true);
CREATE POLICY "write: staff only"    ON public.calendar_breaks FOR ALL    TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


-- ----------------------------------------------------------------
-- 4. course_sections
-- ----------------------------------------------------------------
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read: enrolled or staff" ON public.course_sections FOR SELECT TO authenticated USING (
  public.is_staff()
  OR EXISTS (
    SELECT 1 FROM public.course_enrollments
    WHERE course_id = public.course_sections.course_id
      AND user_id = auth.uid()
  )
);
CREATE POLICY "write: staff only" ON public.course_sections FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


-- ----------------------------------------------------------------
-- 5. calendar_holidays — replace the 3 always-true policies
-- NOTE: if the DROP statements fail due to different policy names,
--       delete them manually in Database → Policies → calendar_holidays
--       then re-run from the CREATE POLICY lines.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read access for all users"          ON public.calendar_holidays;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.calendar_holidays;
DROP POLICY IF EXISTS "Enable update for authenticated users"      ON public.calendar_holidays;
DROP POLICY IF EXISTS "Enable delete for authenticated users"      ON public.calendar_holidays;

CREATE POLICY "read: authenticated" ON public.calendar_holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "write: staff only"   ON public.calendar_holidays FOR ALL    TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


-- ----------------------------------------------------------------
-- 6. handle_new_user — add SET search_path to fix mutable search path
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
begin
  insert into public.users (id, email, role, name)
  values (
    new.id,
    new.email,
    'student',
    split_part(new.email, '@', 1)
  );
  return new;
end;
$$;


-- ----------------------------------------------------------------
-- 7. quizzes — add policies (RLS was enabled but no policies existed)
-- ----------------------------------------------------------------
CREATE POLICY "read: enrolled students see published, staff see all" ON public.quizzes FOR SELECT TO authenticated USING (
  public.is_staff()
  OR EXISTS (
    SELECT 1 FROM public.course_enrollments
    WHERE course_id = public.quizzes.course_id
      AND user_id = auth.uid()
      AND role IN ('instructor', 'ta')
  )
  OR (
    published = true
    AND EXISTS (
      SELECT 1 FROM public.course_enrollments
      WHERE course_id = public.quizzes.course_id
        AND user_id = auth.uid()
    )
  )
);
CREATE POLICY "write: staff only" ON public.quizzes FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());


-- ----------------------------------------------------------------
-- 8. quiz_submissions — add policies
-- ----------------------------------------------------------------
CREATE POLICY "read/write: own submissions" ON public.quiz_submissions FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "read: staff see all" ON public.quiz_submissions FOR SELECT TO authenticated USING (
  public.is_staff()
  OR EXISTS (
    SELECT 1 FROM public.quizzes q
    JOIN public.course_enrollments ce ON ce.course_id = q.course_id
    WHERE q.id = public.quiz_submissions.quiz_id
      AND ce.user_id = auth.uid()
      AND ce.role IN ('instructor', 'ta')
  )
);


-- ----------------------------------------------------------------
-- 9. quiz_progress — add a permissive policy
--    (schema unknown; tighten later once the table is in use)
-- ----------------------------------------------------------------
CREATE POLICY "access: authenticated" ON public.quiz_progress FOR ALL TO authenticated USING (true) WITH CHECK (true);
