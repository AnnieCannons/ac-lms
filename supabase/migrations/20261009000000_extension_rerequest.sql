-- Let a student request another extension after a denial.
-- The original table allowed one request per (assignment, student) ever. Keep the
-- denied rows as history, and instead allow at most one live (pending or
-- approved) request per assignment per student.
ALTER TABLE extension_requests
  DROP CONSTRAINT IF EXISTS extension_requests_assignment_id_student_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS extension_requests_one_live_per_student
  ON extension_requests(assignment_id, student_id)
  WHERE status <> 'denied';
