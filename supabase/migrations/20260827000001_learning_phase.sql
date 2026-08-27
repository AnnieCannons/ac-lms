ALTER TABLE card_progress
  ADD COLUMN IF NOT EXISTS learning_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_at timestamptz;
