-- Career Dev cross-post: allow resources, assignments, and quizzes to appear on a coding day
ALTER TABLE resources   ADD COLUMN IF NOT EXISTS linked_day_id UUID REFERENCES module_days(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS linked_day_id UUID REFERENCES module_days(id) ON DELETE SET NULL;
ALTER TABLE quizzes     ADD COLUMN IF NOT EXISTS linked_day_id UUID REFERENCES module_days(id) ON DELETE SET NULL;
