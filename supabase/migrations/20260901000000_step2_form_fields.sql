-- Step 2 (reflection) check-in form gained two new questions -- "when do you
-- anticipate being back in the green zone" and "any questions for your
-- instructors" -- that don't map onto the existing note/goals/reflection/
-- obstacles columns.
ALTER TABLE accountability_checkins ADD COLUMN IF NOT EXISTS target_green_date text;
ALTER TABLE accountability_checkins ADD COLUMN IF NOT EXISTS questions_for_instructor text;
