-- Confidence Tracker v2, Phase 6: goal-met outcomes ("what helped" answers + reminder state).
--
-- One row per MET goal. confidence_tracker_goal_history stays strictly append-only (a
-- trigger writes it); this table hangs off it, so UNIQUE (goal_history_id) guarantees a
-- goal is met at most once, and goals met before this phase shipped simply have no row
-- (no catch-up). Written only by server actions using the service-role client after an
-- explicit auth check, so there are deliberately NO insert/update/delete policies.

CREATE TABLE IF NOT EXISTS confidence_tracker_goal_outcomes (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_history_id           uuid NOT NULL UNIQUE REFERENCES confidence_tracker_goal_history(id) ON DELETE CASCADE,
  student_id                uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id                  uuid NOT NULL REFERENCES confidence_tracker_skills(id) ON DELETE CASCADE,

  met_at                    timestamptz NOT NULL DEFAULT now(),
  met_rating                int NOT NULL CHECK (met_rating BETWEEN 1 AND 10),
  met_assignment_id         uuid REFERENCES assignments(id) ON DELETE SET NULL,
  -- The student's IANA timezone recorded with the submission the goal was met on (null if
  -- the browser gave none); drives when the next-day reminder is due.
  student_timezone          text,

  -- "What helped" answer: one or more of the option values, plus optional write-in.
  -- 'own_plan' = the student's own study-plan "Other" text for that goal.
  what_helped               text[],
  what_helped_other         text,
  answered_at               timestamptz,

  reminder_sent_at          timestamptz,
  reminder_notification_id  uuid REFERENCES notifications(id) ON DELETE SET NULL,

  created_at                timestamptz NOT NULL DEFAULT now(),

  CHECK (what_helped IS NULL OR (
    array_length(what_helped, 1) > 0
    AND what_helped <@ ARRAY['practice_alone', 'review_lessons', 'ta_help', 'outside_tutorials', 'flashcards', 'review_notes', 'own_plan', 'other']::text[]
  )),
  CHECK ((what_helped IS NULL) = (answered_at IS NULL)),
  CHECK ((what_helped IS NOT NULL AND 'other' = ANY(what_helped)) = (what_helped_other IS NOT NULL)),
  CHECK (what_helped_other IS NULL OR (length(btrim(what_helped_other)) > 0 AND length(what_helped_other) <= 200))
);

CREATE INDEX IF NOT EXISTS idx_confidence_tracker_goal_outcomes_student_skill ON confidence_tracker_goal_outcomes(student_id, skill_id);
-- The reminder cron only scans rows still waiting on an answer and a reminder.
CREATE INDEX IF NOT EXISTS idx_confidence_tracker_goal_outcomes_pending_reminder
  ON confidence_tracker_goal_outcomes(met_at)
  WHERE answered_at IS NULL AND reminder_sent_at IS NULL;

ALTER TABLE confidence_tracker_goal_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students read own confidence_tracker_goal_outcomes, staff read all" ON confidence_tracker_goal_outcomes;
CREATE POLICY "students read own confidence_tracker_goal_outcomes, staff read all"
  ON confidence_tracker_goal_outcomes FOR SELECT
  USING (
    auth.uid() = student_id
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff'))
  );

GRANT ALL ON TABLE public.confidence_tracker_goal_outcomes TO anon;
GRANT ALL ON TABLE public.confidence_tracker_goal_outcomes TO authenticated;
GRANT ALL ON TABLE public.confidence_tracker_goal_outcomes TO service_role;

-- Phase 3 gave skill_progress CHECK (target_date IS NULL OR target_date > CURRENT_DATE).
-- Every rating re-sends the stored target_date on its upsert, so once a goal's date has
-- passed ANY later rating of that skill failed the whole progress save (after the rating
-- row was already inserted). Phase 6 celebrates goals met after their target date, so the
-- CHECK has to go. "Must be a future date" is still enforced when a goal is set
-- (validateGoalInput), and goal_history never had this CHECK. The constraint name is
-- auto-generated, so find it by definition; safe to re-run.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.confidence_tracker_skill_progress'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%CURRENT_DATE%'
  LOOP
    EXECUTE format('ALTER TABLE public.confidence_tracker_skill_progress DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
