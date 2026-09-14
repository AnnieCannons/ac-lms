-- Explicit per-course opt-in for the weekly readiness score, replacing the
-- fragile name-pattern-matching (detectTrack) that used to decide which
-- courses the readiness cron would score. Only meaningful alongside a real
-- airtable_course_name -- enforced in updateCourseDates, not here.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS readiness_enabled boolean NOT NULL DEFAULT false;
