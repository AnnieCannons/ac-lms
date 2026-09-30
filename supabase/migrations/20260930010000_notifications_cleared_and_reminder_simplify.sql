-- 1. Notifications can be cleared: hidden from the bell, but the row stays (so the daily digest
--    email, which reads unsent notifications, is unaffected, and nothing is lost).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS cleared_at timestamptz;

-- 2. Confidence Tracker Phase 6: the "what helped" reminder is now created the moment a goal is
--    reached and stays in the bell until it is answered or cleared, so the next-day reminder job and
--    the timezone/claim columns it needed are gone. (Only test data exists in these columns.)
DROP INDEX IF EXISTS idx_confidence_tracker_goal_outcomes_pending_reminder;
ALTER TABLE confidence_tracker_goal_outcomes DROP COLUMN IF EXISTS reminder_sent_at;
ALTER TABLE confidence_tracker_goal_outcomes DROP COLUMN IF EXISTS student_timezone;
