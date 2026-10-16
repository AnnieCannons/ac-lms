-- Confidence Tracker v2: Growing and Maintaining skills.
--
-- A student who gets back to 10 with no goal to meet is still asked "what helped", and the answer is
-- stored as a goal outcome that has no goal behind it. So goal_history_id becomes optional. The
-- UNIQUE constraint on it is untouched (it still allows any number of NULLs), and every existing
-- row keeps its goal. Nothing is dropped; the mastery columns and skill events stay in place, unused.
-- Safe to run more than once.

ALTER TABLE confidence_tracker_goal_outcomes
  ALTER COLUMN goal_history_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_confidence_tracker_goal_outcomes_student_skill
  ON confidence_tracker_goal_outcomes (student_id, skill_id);
