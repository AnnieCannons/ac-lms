-- Confidence Tracker v2, Phase 3: per-student/skill progress summary — goal/target-date/
-- study-plan capture for a skill's first-ever ("new") rating, plus the running count of
-- 10-ratings that drives mastery. Deliberately a separate, MUTABLE table from the
-- append-only, immutable confidence_tracker_ratings audit trail (no UPDATE/DELETE policy
-- there, by design): a later "reactivate" control needs to reset mastery state and
-- re-open the new-skill flow via a plain UPDATE, which an insert-only table can't support.

CREATE TABLE IF NOT EXISTS confidence_tracker_skill_progress (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id          uuid NOT NULL REFERENCES confidence_tracker_skills(id) ON DELETE CASCADE,

  -- True until this student's first-ever (or first-since-reactivation) rating for this
  -- skill is captured. A future reactivate action flips it back to true — this is the
  -- schema headroom that action needs, with no further migration required then.
  is_new_pending    boolean NOT NULL DEFAULT true,

  -- Goal captured only alongside the new-skill rating described above (NULL/false otherwise).
  goal              int,
  goal_is_maintain  boolean NOT NULL DEFAULT false,
  target_date       date,
  study_plan        text[], -- one or more study-plan values; a student may pick more than one
  study_plan_other  text,

  -- Mastery tracking, across every assignment/occasion this skill is rated for this student.
  ten_rating_count  int NOT NULL DEFAULT 0,
  is_mastered       boolean NOT NULL DEFAULT false,
  mastered_at       timestamptz,
  reactivated_at    timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (student_id, skill_id),

  CHECK (goal IS NULL OR goal BETWEEN 2 AND 10),
  CHECK (NOT goal_is_maintain OR goal IS NULL),
  CHECK (
    -- No goal set at all: nothing else may be set either.
    (goal IS NULL AND NOT goal_is_maintain AND target_date IS NULL AND study_plan IS NULL AND study_plan_other IS NULL)
    -- Numeric goal: target date + study plan are both required.
    OR (goal IS NOT NULL AND NOT goal_is_maintain AND target_date IS NOT NULL AND study_plan IS NOT NULL)
    -- Maintaining a rating already at the max isn't working toward anything, so neither applies.
    OR (goal IS NULL AND goal_is_maintain AND target_date IS NULL AND study_plan IS NULL AND study_plan_other IS NULL)
  ),
  CHECK (study_plan IS NULL OR (
    array_length(study_plan, 1) > 0
    AND study_plan <@ ARRAY['practice_alone', 'review_lessons', 'ta_help', 'outside_tutorials', 'flashcards', 'review_notes', 'other']::text[]
  )),
  CHECK (NOT ('other' = ANY(COALESCE(study_plan, ARRAY[]::text[]))) OR (study_plan_other IS NOT NULL AND length(btrim(study_plan_other)) > 0)),
  CHECK ('other' = ANY(COALESCE(study_plan, ARRAY[]::text[])) OR study_plan_other IS NULL),
  CHECK (target_date IS NULL OR target_date > CURRENT_DATE),
  CHECK (ten_rating_count >= 0),
  CHECK (NOT is_mastered OR mastered_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_confidence_tracker_skill_progress_student_id ON confidence_tracker_skill_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_confidence_tracker_skill_progress_skill_id ON confidence_tracker_skill_progress(skill_id);

ALTER TABLE confidence_tracker_skill_progress ENABLE ROW LEVEL SECURITY;

-- Same student-owns-row / staff-reads-all / TA-excluded pattern as confidence_tracker_ratings.
CREATE POLICY "students read own confidence_tracker_skill_progress, staff read all"
  ON confidence_tracker_skill_progress FOR SELECT
  USING (
    auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff'))
  );

CREATE POLICY "students insert own confidence_tracker_skill_progress"
  ON confidence_tracker_skill_progress FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- UPDATE is needed even in this phase (a later plain 10-rating bumps the same row's
-- count rather than inserting a new one) — and this is the exact policy a future
-- reactivate control will reuse, with no new migration required then.
CREATE POLICY "students update own confidence_tracker_skill_progress"
  ON confidence_tracker_skill_progress FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

GRANT ALL ON TABLE public.confidence_tracker_skill_progress TO anon;
GRANT ALL ON TABLE public.confidence_tracker_skill_progress TO authenticated;
GRANT ALL ON TABLE public.confidence_tracker_skill_progress TO service_role;

CREATE OR REPLACE FUNCTION update_confidence_tracker_skill_progress_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER confidence_tracker_skill_progress_updated_at
  BEFORE UPDATE ON confidence_tracker_skill_progress
  FOR EACH ROW EXECUTE FUNCTION update_confidence_tracker_skill_progress_updated_at();

-- Backfill: any student/skill pair already rated (e.g. Phase 2's brief live verification,
-- per the roadmap) is NOT "new" going forward, and its historical 10-ratings already
-- count toward mastery. Idempotent no-op if the table is empty.
INSERT INTO confidence_tracker_skill_progress (student_id, skill_id, is_new_pending, ten_rating_count, is_mastered, mastered_at)
SELECT
  student_id,
  skill_id,
  false,
  count(*) FILTER (WHERE rating = 10),
  count(*) FILTER (WHERE rating = 10) >= 2,
  CASE WHEN count(*) FILTER (WHERE rating = 10) >= 2 THEN now() END
FROM confidence_tracker_ratings
GROUP BY student_id, skill_id
ON CONFLICT (student_id, skill_id) DO NOTHING;
