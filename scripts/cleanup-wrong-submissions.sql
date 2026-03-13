-- Cleanup: delete submissions where the student is not enrolled in the course
-- that owns the assignment. These were created by the first import run which
-- matched assignment titles without scoping to the course, causing cross-course
-- collisions (e.g. Frontend students' submissions linked to ITP assignments).
--
-- Run this ONCE in Supabase SQL editor, then re-run canvas-import-submissions.ts
-- so comments get attached to the correctly-linked submissions.

-- Preview count first (run this SELECT before the DELETE):
SELECT COUNT(*)
FROM submissions s
JOIN assignments a ON a.id = s.assignment_id
JOIN module_days md ON md.id = a.module_day_id
JOIN modules m ON m.id = md.module_id
WHERE NOT EXISTS (
  SELECT 1 FROM course_enrollments ce
  WHERE ce.course_id = m.course_id
    AND ce.user_id = s.student_id
);

-- Then delete (submission_comments will cascade if FK has ON DELETE CASCADE):
DELETE FROM submissions s
WHERE NOT EXISTS (
  SELECT 1
  FROM assignments a
  JOIN module_days md ON md.id = a.module_day_id
  JOIN modules m ON m.id = md.module_id
  JOIN course_enrollments ce ON ce.course_id = m.course_id AND ce.user_id = s.student_id
  WHERE a.id = s.assignment_id
);
