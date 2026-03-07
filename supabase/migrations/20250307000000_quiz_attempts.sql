-- Add max_attempts to quizzes (null = unlimited)
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS max_attempts integer;

-- Add attempt_count to quiz_submissions
ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 1;
