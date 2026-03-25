-- Add module_id to grading_groups for week-specific rotation

ALTER TABLE grading_groups
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id) ON DELETE CASCADE;

-- Drop the old simple unique constraint (course_id, student_id)
ALTER TABLE grading_groups
  DROP CONSTRAINT IF EXISTS grading_groups_course_id_student_id_key;

-- Partial unique index for course-level rows (module_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS grading_groups_course_student_null_module
  ON grading_groups (course_id, student_id)
  WHERE module_id IS NULL;

-- Partial unique index for week-specific rows (module_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS grading_groups_course_module_student
  ON grading_groups (course_id, module_id, student_id)
  WHERE module_id IS NOT NULL;

-- Performance index for per-module lookups
CREATE INDEX IF NOT EXISTS grading_groups_module_id_idx
  ON grading_groups (module_id)
  WHERE module_id IS NOT NULL;
