-- Partner page redesign — do-not-email moved to per-department (org-wide but
-- dept-specific): each department independently decides whether to email a
-- partner org. Supersedes the per-contact partner_contacts.do_not_email column
-- (left in place, now unused) and the org-wide partners.do_not_email flag.

ALTER TABLE partner_department_status
  ADD COLUMN IF NOT EXISTS do_not_email boolean NOT NULL DEFAULT false;

GRANT SELECT, INSERT, UPDATE, DELETE ON partner_department_status TO anon, authenticated, service_role;
