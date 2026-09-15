-- Adds a stable Airtable student ID (e.g. "S121") to users, so attendance/profile
-- lookups can stop depending on preferred-name matching once names collide.
ALTER TABLE users ADD COLUMN IF NOT EXISTS airtable_student_id text UNIQUE;
