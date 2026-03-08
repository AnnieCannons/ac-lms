-- Per-assignment grader override
-- If set, this grader handles the assignment for ALL students regardless of student group.
-- If null, falls back to each student's assigned grader from grading_groups.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS grader_id UUID REFERENCES users(id) ON DELETE SET NULL;
