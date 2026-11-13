-- The Slack channel readiness posts go to for a course (step 1/2 started,
-- check-in completed, 48h overdue, process completed). Chosen in course setup
-- and Edit Course Settings instead of guessed from the course name, which
-- silently skipped posts for courses whose names didn't match.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS readiness_slack_channel text;

-- One-time backfill using the same name rules the code used to apply on every
-- post (detectTrack); only fills courses that have no channel yet.
UPDATE courses
SET readiness_slack_channel = CASE
  WHEN lower(name || ' ' || coalesce(airtable_course_name, '')) LIKE '%backend%' THEN 'C09DC5MAQ4Q'
  WHEN lower(name || ' ' || coalesce(airtable_course_name, '')) LIKE '%frontend%' THEN 'C09C551E7DM'
  WHEN lower(name || ' ' || coalesce(airtable_course_name, '')) ~ '(itp|tcf|intro to program|foundation)' THEN 'C09C56VL25D'
END
WHERE readiness_slack_channel IS NULL;
