-- Students updating their email in /account only change auth.users.email
-- (via supabase.auth.updateUser, confirmed by clicking the link sent to the
-- new address). public.users.email is a denormalized copy that instructor
-- pages (e.g. /instructor/courses/[id]/users) read from, and it was only
-- ever populated once at signup by handle_new_user — never re-synced on
-- later email changes. Add an AFTER UPDATE trigger, mirroring the existing
-- handle_new_user AFTER INSERT trigger, to keep the two in sync.

CREATE OR REPLACE FUNCTION public.handle_user_email_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
begin
  update public.users
  set email = new.email
  where id = new.id;
  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;

CREATE TRIGGER on_auth_user_email_updated
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.handle_user_email_updated();

-- Backfill: fix any public.users.email rows that already drifted from
-- auth.users.email before this trigger existed.
UPDATE public.users u
SET email = a.email
FROM auth.users a
WHERE u.id = a.id
  AND u.email IS DISTINCT FROM a.email;
