-- Security audit 2026-10-14: defense in depth for core tables whose RLS policies were
-- created in the Supabase dashboard and are NOT in this repo (users, course_enrollments,
-- invitations, submissions). We can't see whether an "update own row" policy exists on
-- them, so this closes the dangerous writes regardless of what the live policies say.
--
-- Safe for the app: every write to users / course_enrollments / invitations goes through
-- the service-role client (people-actions, account-actions, course-actions,
-- enrollment-actions, api/courses/duplicate), and the only browser-client writes to
-- submissions are staff/TA grading (MarkGradedButton, SubmissionComment). The
-- handle_new_user / handle_user_email_updated triggers are SECURITY DEFINER, so the
-- revokes below don't affect sign-up. Idempotent.

-- ─── users / course_enrollments / invitations: no browser writes at all ────────────
-- If any client-write policy exists these would allow, e.g.:
--   supabase.from('users').update({ role: 'admin' }).eq('id', me)
--   supabase.from('course_enrollments').insert({ course_id, user_id: me, role: 'ta' })
--   supabase.from('invitations').insert({ email: me, role: 'admin', ... }) → acceptInvite
REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.course_enrollments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.invitations FROM anon, authenticated;

-- Belt and braces in case a later migration re-GRANTs ALL on users: block role/id
-- changes from browser roles. Deliberately NOT security definer, so current_user is
-- the PostgREST role (service_role and the SECURITY DEFINER auth triggers pass through).
CREATE OR REPLACE FUNCTION public.users_block_client_role_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'users.role can only be changed server-side';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS users_block_client_role_change ON public.users;
CREATE TRIGGER users_block_client_role_change
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_block_client_role_change();

-- ─── submissions: students may not write grades/status from the browser ───────────
-- saveStudentComment used to need a student UPDATE policy on submissions; with no
-- column restriction that also allowed update({ status: 'graded', grade: 'complete' }).
-- Student writes are now all service-role (saveSubmission, saveStudentComment), so any
-- browser-role write must come from staff or a TA of that assignment's course.
CREATE OR REPLACE FUNCTION public.submissions_guard_client_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND NOT public.is_staff()
     AND NOT public.is_ta_for_assignment(NEW.assignment_id) THEN
    RAISE EXCEPTION 'submissions can only be written server-side';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS submissions_guard_client_write ON public.submissions;
CREATE TRIGGER submissions_guard_client_write
  BEFORE INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.submissions_guard_client_write();
