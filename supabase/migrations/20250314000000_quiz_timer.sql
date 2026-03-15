-- Add started_at to quiz_progress (if missing) so we can track when a student begins
ALTER TABLE quiz_progress ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now();

-- Add started_at to quiz_submissions so we can compute how long each attempt took
ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS started_at timestamptz;
