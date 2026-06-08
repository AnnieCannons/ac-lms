-- Add website URL to partner organizations
ALTER TABLE partners ADD COLUMN IF NOT EXISTS website text;
