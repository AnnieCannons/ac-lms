CREATE TABLE IF NOT EXISTS assignment_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_date DATE,
  excused BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

GRANT ALL ON TABLE public.assignment_overrides TO anon;
GRANT ALL ON TABLE public.assignment_overrides TO authenticated;
GRANT ALL ON TABLE public.assignment_overrides TO service_role;
