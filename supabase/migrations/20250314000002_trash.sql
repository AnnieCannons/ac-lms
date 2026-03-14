-- Soft delete support: items move to trash instead of being permanently deleted.
-- deleted_at IS NULL = active, deleted_at IS NOT NULL = in trash.
ALTER TABLE modules      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE module_days  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE assignments  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE resources    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE quizzes      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
