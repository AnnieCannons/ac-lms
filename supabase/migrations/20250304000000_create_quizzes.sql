-- Quizzes table: one row per quiz, synced from course JSON data. Default unpublished.
CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  identifier text NOT NULL,
  title text NOT NULL,
  due_at timestamptz,
  module_title text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(course_id, identifier)
);

CREATE INDEX IF NOT EXISTS idx_quizzes_course_id ON quizzes(course_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_published ON quizzes(course_id, published) WHERE published = true;

COMMENT ON TABLE quizzes IS 'Quizzes per course from data folder; students see only published ones.';
