-- Security audit 2026-10-14: RLS fixes for holes visible in the repo's migrations.
-- Every statement is idempotent. Every table touched here is only written by the app
-- through the service-role client (which bypasses RLS), except where noted, so none of
-- these change what the app itself can do.

-- ─── 1. assignment_overrides: RLS was never enabled, and anon had GRANT ALL ──────────
-- Any visitor holding the public anon key could excuse themselves / move due dates
-- (dropping work off Missing and out of readiness), or read/delete anyone's overrides.
ALTER TABLE public.assignment_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assignment_overrides FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.assignment_overrides FROM authenticated;

DROP POLICY IF EXISTS "read own or staff assignment_overrides" ON public.assignment_overrides;
CREATE POLICY "read own or staff assignment_overrides" ON public.assignment_overrides
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_staff() OR public.is_ta_for_assignment(assignment_id));

-- ─── 2. grade_history: RLS was never enabled, and anon had GRANT ALL ────────────────
-- Anyone could insert/delete grading history (feeds Needs Revision counts + readiness).
-- All reads and writes are service-role, so no policies = service-role only.
ALTER TABLE public.grade_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.grade_history FROM anon, authenticated;

-- ─── 3. admissions_applications: RLS was never enabled ─────────────────────────────
-- anon could read, any logged-in user could write. Only scripts use it.
ALTER TABLE public.admissions_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admissions_applications FROM anon;

DROP POLICY IF EXISTS "staff and admin manage admissions_applications" ON public.admissions_applications;
CREATE POLICY "staff and admin manage admissions_applications" ON public.admissions_applications
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('staff', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('staff', 'admin')));

-- ─── 4. quizzes: enrolled students could read the answer key from the browser ───────
-- `supabase.from('quizzes').select('questions')` returned correct_response_ident.
-- Every student quiz read goes through the service client, so the student branch goes.
DROP POLICY IF EXISTS "read: enrolled students see published, staff see all" ON public.quizzes;
DROP POLICY IF EXISTS "read: staff or course instructor/ta" ON public.quizzes;
CREATE POLICY "read: staff or course instructor/ta" ON public.quizzes
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.course_id = quizzes.course_id
        AND ce.user_id = auth.uid()
        AND ce.role IN ('instructor', 'ta')
    )
  );

-- ─── 5. quiz_submissions / quiz_progress: students could write their own scores ─────
-- "read/write: own submissions" was FOR ALL, so a student could upsert
-- score_percent = 100 / attempt_count = 0, or rewrite their timer start. Writes are
-- service-role only (submitQuiz, /api/quiz-progress); students keep read-own.
ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read/write: own submissions" ON public.quiz_submissions;
DROP POLICY IF EXISTS "read: own quiz_submissions" ON public.quiz_submissions;
CREATE POLICY "read: own quiz_submissions" ON public.quiz_submissions
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

ALTER TABLE public.quiz_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quiz_progress_own" ON public.quiz_progress;
DROP POLICY IF EXISTS "quiz_progress_read_own" ON public.quiz_progress;
CREATE POLICY "quiz_progress_read_own" ON public.quiz_progress
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- ─── 6. accountability_checkins: students could forge check-ins ────────────────────
-- A forged (e.g. future-dated) acknowledgment row made hasCompletedCheckin true for
-- every later escalation, silencing the overdue reminders. The real insert
-- (submitCheckinForm) is service-role.
DROP POLICY IF EXISTS "student insert own accountability_checkins" ON public.accountability_checkins;
REVOKE INSERT, UPDATE, DELETE ON public.accountability_checkins FROM anon, authenticated;

-- ─── 7. extension_requests: student insert didn't pin status / reviewer fields ──────
-- requestExtension inserts through the RLS client with status 'pending', so this
-- stays compatible; it just stops a student inserting a pre-"approved" request or
-- dropping one into a course they aren't in.
DROP POLICY IF EXISTS "students_insert_extension_requests" ON public.extension_requests;
CREATE POLICY "students_insert_extension_requests" ON public.extension_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND instructor_comment IS NULL
    AND EXISTS (
      SELECT 1 FROM public.course_enrollments ce
      WHERE ce.course_id = extension_requests.course_id AND ce.user_id = auth.uid()
    )
  );
