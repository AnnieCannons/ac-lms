-- Add needs_outreach to partner_department_status (Funding Partners-specific)
ALTER TABLE partner_department_status
  ADD COLUMN IF NOT EXISTS needs_outreach TEXT;

-- Add interaction_type to partner_interactions
ALTER TABLE partner_interactions
  ADD COLUMN IF NOT EXISTS interaction_type TEXT;

GRANT ALL ON partner_department_status TO anon, authenticated, service_role;
GRANT ALL ON partner_interactions TO anon, authenticated, service_role;
