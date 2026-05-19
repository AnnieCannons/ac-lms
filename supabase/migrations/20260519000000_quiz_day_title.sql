-- Add day_title to quizzes so instructors can pin quizzes to a specific day (Mon-Thu)
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS day_title TEXT;
