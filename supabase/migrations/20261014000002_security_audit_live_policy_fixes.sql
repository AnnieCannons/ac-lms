-- Security audit 2026-10-14, part 3: holes found by running the audit's pg_policies
-- diagnostic against the live database. These policies were created in the Supabase
-- dashboard under names the repo never knew, so 20261014000000 didn't drop them
-- (permissive policies OR together, so one wide-open policy defeats the rest).
-- Apply after 20261014000000 and 20261014000001. Idempotent.

-- ─── 1. quiz_progress: "access: authenticated" was ALL / true / true ───────────────
-- Any logged-in user could read, rewrite or delete every student's in-progress answers
-- and timer. All app access is service-role (api/quiz-progress, quiz actions, the
-- student quiz page and conduct page), so browsers only keep read-own + staff read.
DROP POLICY IF EXISTS "access: authenticated" ON public.quiz_progress;
REVOKE INSERT, UPDATE, DELETE ON public.quiz_progress FROM anon, authenticated;

-- ─── 2. resources: "Resources viewable by authenticated users" was USING (true) ────
-- Any logged-in user could select instructor_only (and unpublished/deleted) resources
-- straight from the browser; the app only filtered them in its own queries. Staff
-- (users.role instructor/admin/staff) still see everything — is_staff() doesn't include
-- 'staff', so that role is listed explicitly. TAs keep ta_select_resources.
-- Student pages already query with instructor_only = false AND published = true.
DROP POLICY IF EXISTS "Resources viewable by authenticated users" ON public.resources;
DROP POLICY IF EXISTS "resources_select_visible_or_staff" ON public.resources;
CREATE POLICY "resources_select_visible_or_staff" ON public.resources
  FOR SELECT TO authenticated
  USING (
    (instructor_only IS NOT TRUE AND published IS NOT FALSE AND deleted_at IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('instructor', 'admin', 'staff')
    )
  );

-- ─── 3. partner_ratings: student insert only checked reviewer_id ──────────────────
-- A student could insert ratings for any partner straight from the browser, skipping
-- createRating's referral check. Now the row must be a student rating of the partner
-- on one of the student's own referrals (students can read their own referrals via
-- "students can read own referrals"). Staff/admin keep ratings_staff_all.
DROP POLICY IF EXISTS "ratings_student_insert" ON public.partner_ratings;
CREATE POLICY "ratings_student_insert" ON public.partner_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND reviewer_type = 'student'
    AND EXISTS (
      SELECT 1 FROM public.student_referrals r
      WHERE r.id = partner_ratings.referral_id
        AND r.student_user_id = auth.uid()
        AND r.partner_id = partner_ratings.partner_id
    )
  );

-- ─── 4. submission_comments: "author_or_staff" was ALL with no WITH CHECK ───────────
-- Its USING (author_id = auth.uid()) doubled as the insert check, so anyone could add a
-- comment as themselves on any submission id, or move their comment to another one.
-- All comment writes are service-role (grade-actions). Keep the read half: authors can
-- still see comments they wrote. Students keep their scoped insert/read policies.
DROP POLICY IF EXISTS "author_or_staff" ON public.submission_comments;
DROP POLICY IF EXISTS "submission_comments_author_read" ON public.submission_comments;
CREATE POLICY "submission_comments_author_read" ON public.submission_comments
  FOR SELECT TO authenticated
  USING (author_id = auth.uid());
