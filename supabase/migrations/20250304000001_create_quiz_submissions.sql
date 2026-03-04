-- Quiz submissions: one row per student per quiz attempt.
CREATE TABLE IF NOT EXISTS quiz_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  score_percent numeric(5,2),
  UNIQUE(quiz_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_quiz_id ON quiz_submissions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_student_id ON quiz_submissions(student_id);

COMMENT ON TABLE quiz_submissions IS 'Student quiz attempts; answers is array of { question_ident, choice_ident }.';
COMMENT ON COLUMN quiz_submissions.answers IS 'Array of { question_ident: string, choice_ident: string }.';
COMMENT ON COLUMN quiz_submissions.score_percent IS 'Optional: 0-100, computed from correct answers.';
