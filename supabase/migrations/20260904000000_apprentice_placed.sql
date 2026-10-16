-- Add apprentice_placed to partner_department_status (Career Development-specific)
ALTER TABLE partner_department_status
  ADD COLUMN IF NOT EXISTS apprentice_placed BOOLEAN NOT NULL DEFAULT false;

GRANT ALL ON partner_department_status TO anon, authenticated, service_role;
