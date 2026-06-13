-- Partner page redesign — Phase 1 (ResourceFull).
-- All additive; safe for the departments not yet converted.

-- Per-department primary contact: which departments this contact is primary for.
ALTER TABLE partner_contacts
  ADD COLUMN IF NOT EXISTS primary_departments text[] DEFAULT '{}';

-- Per-contact "do not email" (the new UI surfaces this in the Log Contact modal,
-- replacing the org-wide partners.do_not_email flag going forward).
ALTER TABLE partner_contacts
  ADD COLUMN IF NOT EXISTS do_not_email boolean DEFAULT false;

-- Attribute an interaction to a specific contact (NULL = general note).
ALTER TABLE partner_interactions
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES partner_contacts(id) ON DELETE SET NULL;

-- Persist the follow-up reminder so it can be shown on the activity timeline.
ALTER TABLE partner_interactions
  ADD COLUMN IF NOT EXISTS reminder_days integer,
  ADD COLUMN IF NOT EXISTS reminder_at date;

GRANT SELECT, INSERT, UPDATE, DELETE ON partner_contacts TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON partner_interactions TO anon, authenticated, service_role;
