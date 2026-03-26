-- Grade history: records every time a submission is graded (complete or incomplete)
CREATE TABLE IF NOT EXISTS grade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  grade TEXT NOT NULL CHECK (grade IN ('complete', 'incomplete')),
  graded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS grade_history_submission_id_idx ON grade_history (submission_id);
