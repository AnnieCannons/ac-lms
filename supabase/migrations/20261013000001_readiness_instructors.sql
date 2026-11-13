-- The course's actual instructors, chosen when a course is created/duplicated
-- and editable in Edit Course Settings. Readiness step 3 group DMs and the 48h
-- overdue check-in reminder go to these people (plus the student, and for
-- step 3 the always-included program staff) instead of every role='instructor'
-- enrollment, which fills up with staff who were self-enrolled to edit content.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS readiness_instructor_ids uuid[] NOT NULL DEFAULT '{}';
