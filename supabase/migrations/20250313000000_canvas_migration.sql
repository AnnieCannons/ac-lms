-- Canvas migration support
-- Adds canvas_user_id to users for matching, canvas_course_id to courses,
-- and makes submission_comments.author_id nullable (with author_name fallback)
-- so Canvas-imported comments can be stored without a matching user account.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS canvas_user_id bigint UNIQUE;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS canvas_course_id text UNIQUE;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS canvas_assignment_id bigint UNIQUE;

ALTER TABLE submission_comments
  ALTER COLUMN author_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS author_name text;
