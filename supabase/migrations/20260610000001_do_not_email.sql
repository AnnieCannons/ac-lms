-- Org-wide "do not email" flag on partners
-- Any department can set this; it applies across all departments and email lists.

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS do_not_email        boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_email_notes  text,
  ADD COLUMN IF NOT EXISTS do_not_email_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS do_not_email_set_by uuid REFERENCES users(id) ON DELETE SET NULL;
