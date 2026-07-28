-- Weekly snapshot of per-student assignment stats (missing / needs revision)
-- so the instructor Students page can chart trends over the course.
CREATE TABLE IF NOT EXISTS student_stats_snapshots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id             uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  week_start            date NOT NULL,
  missing_count         int NOT NULL,
  needs_revision_count  int NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_student_stats_snapshots_student_course
  ON student_stats_snapshots (student_id, course_id, week_start);

ALTER TABLE student_stats_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructor staff admin read student_stats_snapshots"
  ON student_stats_snapshots FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('instructor', 'staff', 'admin')
  ));

GRANT SELECT ON TABLE public.student_stats_snapshots TO authenticated;
GRANT ALL ON TABLE public.student_stats_snapshots TO service_role;
GRANT SELECT ON TABLE public.student_stats_snapshots TO anon;
