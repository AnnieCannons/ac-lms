-- Extension requests: students request a due date extension per assignment
CREATE TABLE IF NOT EXISTS extension_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  reason_other TEXT,
  plan TEXT[] NOT NULL DEFAULT '{}',
  plan_other TEXT,
  requested_due_date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  instructor_comment TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS extension_requests_course_id ON extension_requests(course_id);
CREATE INDEX IF NOT EXISTS extension_requests_student_id ON extension_requests(student_id);
CREATE INDEX IF NOT EXISTS extension_requests_assignment_id ON extension_requests(assignment_id);

-- RLS
ALTER TABLE extension_requests ENABLE ROW LEVEL SECURITY;

-- Students can see their own requests
CREATE POLICY "students_select_own_extension_requests"
  ON extension_requests FOR SELECT
  USING (auth.uid() = student_id);

-- Students can insert their own requests
CREATE POLICY "students_insert_extension_requests"
  ON extension_requests FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Students can delete (cancel) their own pending requests
CREATE POLICY "students_delete_pending_extension_requests"
  ON extension_requests FOR DELETE
  USING (auth.uid() = student_id AND status = 'pending');

-- Instructors/admins can see all requests for courses they teach
CREATE POLICY "instructors_select_extension_requests"
  ON extension_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('instructor', 'admin')
    )
  );

-- Instructors/admins can update (review) extension requests
CREATE POLICY "instructors_update_extension_requests"
  ON extension_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('instructor', 'admin')
    )
  );

-- TAs enrolled in the course can also view and update extension requests
CREATE POLICY "ta_select_extension_requests"
  ON extension_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM course_enrollments
      WHERE user_id = auth.uid() AND course_id = extension_requests.course_id AND role = 'ta'
    )
  );

CREATE POLICY "ta_update_extension_requests"
  ON extension_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM course_enrollments
      WHERE user_id = auth.uid() AND course_id = extension_requests.course_id AND role = 'ta'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- In-app notifications
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  extension_request_id UUID REFERENCES extension_requests(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_unread ON notifications(user_id, read) WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "users_select_own_notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
CREATE POLICY "users_update_own_notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

GRANT ALL ON TABLE public.extension_requests TO anon;
GRANT ALL ON TABLE public.extension_requests TO authenticated;
GRANT ALL ON TABLE public.extension_requests TO service_role;

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;
