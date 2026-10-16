-- Confidence Tracker v2, Phase 4: append-only history alongside the mutable
-- confidence_tracker_skill_progress "current state" row.
--
-- skill_progress holds ONE row per student/skill, so a goal captured later (e.g. after a
-- reactivation) or a second mastery cycle would overwrite what came before. These two
-- tables keep every goal and every mastery/reactivation as its own dated row instead.
-- They are written only by the trigger below (SECURITY DEFINER), so Phase 3's
-- saveConfidenceRatings and Phase 4's reactivate UPDATE need no extra code to keep
-- history, and the snapshot is atomic with the state change.

CREATE TABLE IF NOT EXISTS confidence_tracker_goal_history (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id          uuid NOT NULL REFERENCES confidence_tracker_skills(id) ON DELETE CASCADE,

  goal              int,
  goal_is_maintain  boolean NOT NULL DEFAULT false,
  -- No future-date CHECK here (unlike skill_progress): these are historical snapshots,
  -- and a target date is expected to pass.
  target_date       date,
  study_plan        text[],
  study_plan_other  text,

  created_at        timestamptz NOT NULL DEFAULT now(),

  CHECK (goal IS NULL OR goal BETWEEN 2 AND 10),
  CHECK (NOT goal_is_maintain OR goal IS NULL),
  CHECK (goal IS NOT NULL OR goal_is_maintain),
  CHECK (study_plan IS NULL OR (
    array_length(study_plan, 1) > 0
    AND study_plan <@ ARRAY['practice_alone', 'review_lessons', 'ta_help', 'outside_tutorials', 'flashcards', 'review_notes', 'other']::text[]
  ))
);

CREATE TABLE IF NOT EXISTS confidence_tracker_skill_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id    uuid NOT NULL REFERENCES confidence_tracker_skills(id) ON DELETE CASCADE,
  event_type  text NOT NULL CHECK (event_type IN ('mastered', 'reactivated')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_confidence_tracker_goal_history_student_skill ON confidence_tracker_goal_history(student_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_confidence_tracker_skill_events_student_skill ON confidence_tracker_skill_events(student_id, skill_id);

ALTER TABLE confidence_tracker_goal_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_tracker_skill_events ENABLE ROW LEVEL SECURITY;

-- Same student-owns-row / staff-reads-all / TA-excluded pattern as the other
-- confidence_tracker_* tables. Deliberately NO insert/update/delete policies: only the
-- SECURITY DEFINER trigger below writes these tables.
DROP POLICY IF EXISTS "students read own confidence_tracker_goal_history, staff read all" ON confidence_tracker_goal_history;
CREATE POLICY "students read own confidence_tracker_goal_history, staff read all"
  ON confidence_tracker_goal_history FOR SELECT
  USING (
    auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff'))
  );

DROP POLICY IF EXISTS "students read own confidence_tracker_skill_events, staff read all" ON confidence_tracker_skill_events;
CREATE POLICY "students read own confidence_tracker_skill_events, staff read all"
  ON confidence_tracker_skill_events FOR SELECT
  USING (
    auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff'))
  );

GRANT ALL ON TABLE public.confidence_tracker_goal_history TO anon;
GRANT ALL ON TABLE public.confidence_tracker_goal_history TO authenticated;
GRANT ALL ON TABLE public.confidence_tracker_goal_history TO service_role;
GRANT ALL ON TABLE public.confidence_tracker_skill_events TO anon;
GRANT ALL ON TABLE public.confidence_tracker_skill_events TO authenticated;
GRANT ALL ON TABLE public.confidence_tracker_skill_events TO service_role;

CREATE OR REPLACE FUNCTION record_confidence_tracker_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Snapshot a goal the moment it is captured (or changed). Reactivation clears the goal
  -- columns on the progress row, so a goal captured afterwards is always "distinct" from
  -- OLD and gets its own snapshot even if its value repeats the earlier one.
  IF (NEW.goal IS NOT NULL OR NEW.goal_is_maintain) AND (
       TG_OP = 'INSERT'
       OR OLD.goal IS DISTINCT FROM NEW.goal
       OR OLD.goal_is_maintain IS DISTINCT FROM NEW.goal_is_maintain
       OR OLD.target_date IS DISTINCT FROM NEW.target_date
       OR OLD.study_plan IS DISTINCT FROM NEW.study_plan
       OR OLD.study_plan_other IS DISTINCT FROM NEW.study_plan_other
     ) THEN
    INSERT INTO confidence_tracker_goal_history
      (student_id, skill_id, goal, goal_is_maintain, target_date, study_plan, study_plan_other)
    VALUES
      (NEW.student_id, NEW.skill_id, NEW.goal, NEW.goal_is_maintain, NEW.target_date, NEW.study_plan, NEW.study_plan_other);
  END IF;

  IF NEW.is_mastered AND (TG_OP = 'INSERT' OR NOT OLD.is_mastered) THEN
    INSERT INTO confidence_tracker_skill_events (student_id, skill_id, event_type, created_at)
    VALUES (NEW.student_id, NEW.skill_id, 'mastered', COALESCE(NEW.mastered_at, now()));
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_mastered AND NOT NEW.is_mastered THEN
    INSERT INTO confidence_tracker_skill_events (student_id, skill_id, event_type, created_at)
    VALUES (NEW.student_id, NEW.skill_id, 'reactivated', COALESCE(NEW.reactivated_at, now()));
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS confidence_tracker_skill_progress_history ON confidence_tracker_skill_progress;
CREATE TRIGGER confidence_tracker_skill_progress_history
  AFTER INSERT OR UPDATE ON confidence_tracker_skill_progress
  FOR EACH ROW EXECUTE FUNCTION record_confidence_tracker_history();

-- Backfill from progress rows that already exist (dev/staging data — the feature flag is
-- off in production). Timestamps are approximate: the progress row's created_at for goals,
-- mastered_at for mastery. Guarded so a re-run adds nothing.
INSERT INTO confidence_tracker_goal_history
  (student_id, skill_id, goal, goal_is_maintain, target_date, study_plan, study_plan_other, created_at)
SELECT p.student_id, p.skill_id, p.goal, p.goal_is_maintain, p.target_date, p.study_plan, p.study_plan_other, p.created_at
FROM confidence_tracker_skill_progress p
WHERE (p.goal IS NOT NULL OR p.goal_is_maintain)
  AND NOT EXISTS (
    SELECT 1 FROM confidence_tracker_goal_history h
    WHERE h.student_id = p.student_id AND h.skill_id = p.skill_id
  );

INSERT INTO confidence_tracker_skill_events (student_id, skill_id, event_type, created_at)
SELECT p.student_id, p.skill_id, 'mastered', COALESCE(p.mastered_at, now())
FROM confidence_tracker_skill_progress p
WHERE p.is_mastered
  AND NOT EXISTS (
    SELECT 1 FROM confidence_tracker_skill_events e
    WHERE e.student_id = p.student_id AND e.skill_id = p.skill_id AND e.event_type = 'mastered'
  );
