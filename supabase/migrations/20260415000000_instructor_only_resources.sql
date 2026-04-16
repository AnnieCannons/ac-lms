-- Add instructor_only flag to resources
-- Resources with instructor_only = true are visible to instructors/admins/TAs only, never students

ALTER TABLE resources ADD COLUMN IF NOT EXISTS instructor_only boolean NOT NULL DEFAULT false;
