-- Retire the original Confidence Tracker (per-student, free-text skills and score entries).
-- Its data was deleted on 2026-10-09 and its pages and components were removed from the app.
-- Dropping a table also drops its indexes and RLS policies. Entries go first because they
-- reference skills. Apply this only after the app version without the old pages is live,
-- or the old pages would error.
DROP TABLE IF EXISTS confidence_entries;
DROP TABLE IF EXISTS confidence_skills;
