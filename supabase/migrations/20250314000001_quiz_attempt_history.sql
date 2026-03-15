-- Store per-attempt timing as a JSON array so we can show how long each attempt took
ALTER TABLE quiz_submissions ADD COLUMN IF NOT EXISTS attempt_history jsonb DEFAULT '[]';
