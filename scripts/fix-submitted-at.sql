-- Fix submitted_at for Canvas-imported submissions where submitted_at was set
-- to the import date (2026-03-13) because Canvas had no submitted_at value.
-- Sets submitted_at to 1 day before the assignment's due_date so they don't
-- appear late. If the assignment has no due_date, leaves it unchanged.
--
-- Run once in Supabase SQL editor after canvas-import-submissions.ts has run.

UPDATE submissions s
SET submitted_at = (
  SELECT a.due_date - INTERVAL '1 day'
  FROM assignments a
  WHERE a.id = s.assignment_id
    AND a.due_date IS NOT NULL
)
WHERE s.submitted_at::date = '2026-03-13'
  AND s.grade = 'complete'
  AND EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.id = s.assignment_id AND a.due_date IS NOT NULL
  );
