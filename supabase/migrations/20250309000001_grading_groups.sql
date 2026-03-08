-- grading_groups: maps students to a TA grader per course
CREATE TABLE IF NOT EXISTS grading_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grader_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, student_id)
);

ALTER TABLE grading_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can manage grading groups"
  ON grading_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('instructor', 'admin')
    )
  );
