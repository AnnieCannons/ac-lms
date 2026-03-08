-- Add skill_tags array and is_bonus flag to assignments
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS skill_tags text[] DEFAULT '{}';
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_bonus boolean NOT NULL DEFAULT false;
