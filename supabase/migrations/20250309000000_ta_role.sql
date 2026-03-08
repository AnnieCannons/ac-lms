-- Add 'ta' as a valid value for course_enrollments.role
-- Note: user_role enum is for the users table (admin/instructor/student)
-- TA is a course-scoped role stored in course_enrollments.role (text column)
-- No enum change needed — course_enrollments.role is already a text column.
-- This migration serves as documentation of the ta role addition.

-- Verify course_enrollments.role is a text column (no-op if already text)
-- Run this in Supabase SQL editor before deploying the TA feature.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'course_enrollments' AND column_name = 'role';
