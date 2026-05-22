ALTER TABLE courses ADD COLUMN IF NOT EXISTS airtable_course_name TEXT;

GRANT SELECT, INSERT, UPDATE, DELETE ON courses TO anon, authenticated, service_role;
