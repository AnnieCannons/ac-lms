-- Confidence Tracker v2, Phase 1: canonical shared skill taxonomy + assignment tagging.
-- Deliberately separate from:
--   - `confidence_skills`/`confidence_entries` (the existing per-student, free-text Confidence Tracker)
--   - `assignments.skill_tags`/`modules.skill_tags` (the unrelated "Level Up Your Skills" preset+free-text tags)

CREATE TABLE confidence_tracker_skills (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  normalized_name text NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE confidence_tracker_assignment_skills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  skill_id      uuid NOT NULL REFERENCES confidence_tracker_skills(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, skill_id)
);

ALTER TABLE confidence_tracker_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_tracker_assignment_skills ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read the skill list/tags — a later phase has students
-- read an assignment's tagged skills to prompt a confidence rating at submission time.
CREATE POLICY "authenticated users can read confidence_tracker_skills"
  ON confidence_tracker_skills FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated users can read confidence_tracker_assignment_skills"
  ON confidence_tracker_assignment_skills FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins/instructors/staff can create, rename, or tag skills. TAs are
-- deliberately excluded (course-scoped grading access only, no content tagging).
CREATE POLICY "instructors can manage confidence_tracker_skills"
  ON confidence_tracker_skills FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff'))
  );

CREATE POLICY "instructors can update confidence_tracker_skills"
  ON confidence_tracker_skills FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff'))
  );

CREATE POLICY "instructors can manage confidence_tracker_assignment_skills"
  ON confidence_tracker_assignment_skills FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff'))
  );

CREATE POLICY "instructors can delete confidence_tracker_assignment_skills"
  ON confidence_tracker_assignment_skills FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff'))
  );

GRANT ALL ON TABLE public.confidence_tracker_skills TO anon;
GRANT ALL ON TABLE public.confidence_tracker_skills TO authenticated;
GRANT ALL ON TABLE public.confidence_tracker_skills TO service_role;

GRANT ALL ON TABLE public.confidence_tracker_assignment_skills TO anon;
GRANT ALL ON TABLE public.confidence_tracker_assignment_skills TO authenticated;
GRANT ALL ON TABLE public.confidence_tracker_assignment_skills TO service_role;
