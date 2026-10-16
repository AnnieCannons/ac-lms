-- Lets instructors hide staff/TAs from a course's Grading Groups page without
-- unenrolling them (they keep course access, they just aren't a grader).
ALTER TABLE course_enrollments
  ADD COLUMN IF NOT EXISTS excluded_from_grading boolean NOT NULL DEFAULT false;
