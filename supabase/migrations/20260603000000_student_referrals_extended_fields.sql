-- Add extended fields to student_referrals that were in the app code but missing from the schema.
-- These columns support: linked student accounts, multi-service categories, outcome tracking,
-- staff notes, course context, and rating request deduplication.

ALTER TABLE student_referrals
  ADD COLUMN IF NOT EXISTS student_user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_category     text,
  ADD COLUMN IF NOT EXISTS outcome_success      boolean,
  ADD COLUMN IF NOT EXISTS staff_notes          text,
  ADD COLUMN IF NOT EXISTS course_name          text,
  ADD COLUMN IF NOT EXISTS rating_request_sent_at timestamptz;

-- Allow students to read their own referrals (for the rate page)
CREATE POLICY "students can read own referrals"
  ON student_referrals FOR SELECT
  USING (student_user_id = auth.uid());
