-- Add skill_tags array to modules for Level Up section filtering
ALTER TABLE modules ADD COLUMN IF NOT EXISTS skill_tags text[] DEFAULT '{}';
