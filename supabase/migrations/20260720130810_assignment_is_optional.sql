-- Optional assignments: excluded from Not Started/Missing tracking (e.g. "pick any 3 of 12" exercise sets)
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_optional boolean NOT NULL DEFAULT false;
