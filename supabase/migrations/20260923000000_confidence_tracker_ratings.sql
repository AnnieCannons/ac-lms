-- Confidence Tracker v2, Phase 2: first-submission confidence rating capture.
-- One row per student/assignment/skill. Fully separate from:
--   - `confidence_skills`/`confidence_entries` (the existing per-student, free-text Confidence Tracker)
--   - `assignments.skill_tags`/`modules.skill_tags` (the unrelated "Level Up Your Skills" preset+free-text tags)

CREATE TABLE confidence_tracker_ratings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  skill_id      uuid NOT NULL REFERENCES confidence_tracker_skills(id) ON DELETE CASCADE,
  rating        int NOT NULL CHECK (rating BETWEEN 1 AND 10),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, assignment_id, skill_id)
);

CREATE INDEX idx_confidence_tracker_ratings_student_id ON confidence_tracker_ratings(student_id);
CREATE INDEX idx_confidence_tracker_ratings_assignment_id ON confidence_tracker_ratings(assignment_id);

ALTER TABLE confidence_tracker_ratings ENABLE ROW LEVEL SECURITY;

-- A student reads their own ratings; staff/instructor/admin (not TA, matching Phase 1's
-- precedent) can read everyone's — anticipating the Phase 4 instructor trend page.
CREATE POLICY "students read own confidence_tracker_ratings, staff read all"
  ON confidence_tracker_ratings FOR SELECT
  USING (
    auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff'))
  );

-- A student can only insert their own ratings. No UPDATE/DELETE policy — ratings
-- aren't edited or removed in this phase.
CREATE POLICY "students insert own confidence_tracker_ratings"
  ON confidence_tracker_ratings FOR INSERT
  WITH CHECK (auth.uid() = student_id);

GRANT ALL ON TABLE public.confidence_tracker_ratings TO anon;
GRANT ALL ON TABLE public.confidence_tracker_ratings TO authenticated;
GRANT ALL ON TABLE public.confidence_tracker_ratings TO service_role;
