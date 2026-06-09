-- Add is_archived flag to partner_contacts for soft-archiving replaced contacts
ALTER TABLE partner_contacts
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

GRANT SELECT, INSERT, UPDATE, DELETE ON partner_contacts TO anon, authenticated, service_role;
