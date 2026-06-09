-- Allow contacts to be scoped to specific departments.
-- NULL = shared across all departments (backward-compatible default).
ALTER TABLE partner_contacts
  ADD COLUMN IF NOT EXISTS departments text[] DEFAULT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON partner_contacts TO anon, authenticated, service_role;
