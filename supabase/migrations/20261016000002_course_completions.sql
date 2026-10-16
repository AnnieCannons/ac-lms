-- Course completion: an instructor marks that a student completed a course. Shown as a
-- "Completed" badge on the course's Users and Roster pages and on /instructor/students,
-- and used by the Hardware Tracker (a loaned laptop becomes the student's once they have
-- completed both Tech Career Foundations and Intro to Programming).
-- See _plans/hardware-tracker-roadmap.md, Phase 2.
--
-- Writes go through server actions using the service-role client after an explicit
-- instructor/staff/admin check, so there are deliberately NO insert/update/delete policies.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS course_completions (
  course_id     uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_at  timestamptz NOT NULL DEFAULT now(),
  marked_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_course_completions_user ON course_completions(user_id);

ALTER TABLE course_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students read own course_completions, staff read all" ON course_completions;
CREATE POLICY "students read own course_completions, staff read all"
  ON course_completions FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff'))
  );

GRANT ALL ON TABLE public.course_completions TO anon;
GRANT ALL ON TABLE public.course_completions TO authenticated;
GRANT ALL ON TABLE public.course_completions TO service_role;
