-- Form submissions: records Airtable form submissions via webhook
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_name TEXT NOT NULL,
  program TEXT,
  submission_type TEXT,
  airtable_record_id TEXT,
  payload JSONB,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS form_submissions_form_name ON form_submissions(form_name);
CREATE INDEX IF NOT EXISTS form_submissions_program ON form_submissions(program);
CREATE INDEX IF NOT EXISTS form_submissions_submitted_at ON form_submissions(submitted_at DESC);

-- RLS
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Only instructors, staff, and admins can read submissions
CREATE POLICY "staff_select_form_submissions"
  ON form_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('instructor', 'staff', 'admin')
    )
  );

-- Only service_role (edge function) can insert
CREATE POLICY "service_insert_form_submissions"
  ON form_submissions FOR INSERT
  WITH CHECK (false);

GRANT ALL ON TABLE public.form_submissions TO anon;
GRANT ALL ON TABLE public.form_submissions TO authenticated;
GRANT ALL ON TABLE public.form_submissions TO service_role;
