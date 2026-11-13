-- Repeating assignments ("series") + the "I met my goal" check-off.
--
-- 1. assignments.series_id groups copies of one assignment pushed to several weeks
--    (e.g. the weekly ITP typing test). Each copy is still its own assignment with its
--    own due date, submissions and gradebook column; the series only links them so
--    edits can be pushed to upcoming weeks and a met goal can excuse the later ones.
-- 2. assignments.goal_checkoff_label: when set, students see an extra checkbox with this
--    label (e.g. "I met my typing goal this week").
-- 3. assignment_goal_claims: a student's "I met my goal" check, and the grader's
--    confirmation. Confirming excuses the student from every later assignment in the
--    series (through the existing assignment_overrides.excused); the ids it excused are
--    kept so an undo puts back exactly those.
--
-- Idempotent: safe to paste more than once.

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS series_id uuid;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS goal_checkoff_label text;

CREATE INDEX IF NOT EXISTS assignments_series_id_idx ON assignments(series_id) WHERE series_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS assignment_goal_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Assignments this confirmation excused (so un-confirming removes only those).
  excused_assignment_ids uuid[] NOT NULL DEFAULT '{}',
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS assignment_goal_claims_student_idx ON assignment_goal_claims(student_id);

ALTER TABLE assignment_goal_claims ENABLE ROW LEVEL SECURITY;

-- Students can read their own claims. Every write goes through server actions using the
-- service client, which check the caller themselves.
DROP POLICY IF EXISTS "goal_claims_select_own" ON assignment_goal_claims;
CREATE POLICY "goal_claims_select_own" ON assignment_goal_claims
  FOR SELECT USING (student_id = auth.uid());

GRANT ALL ON assignment_goal_claims TO anon;
GRANT ALL ON assignment_goal_claims TO authenticated;
GRANT ALL ON assignment_goal_claims TO service_role;
