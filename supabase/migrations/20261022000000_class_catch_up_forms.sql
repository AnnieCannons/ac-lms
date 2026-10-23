-- Class Catch Up Form, rebuilt in the LMS (was an Airtable form).
-- Attendance itself stays in Airtable. A 5am Pacific cron (/api/cron/catch-up-reminders)
-- reads the last few days of Airtable attendance and Slack DMs each student with an
-- Absent block a link to /student/courses/[id]/catch-up, once per student per day
-- (class_absence_alerts). Submitting the form Slack DMs the course's instructors to
-- follow up; they see submissions at /instructor/courses/[id]/catch-up.
--
-- Writes go through server actions / the cron using the service-role client after an
-- explicit auth or role check, so there are deliberately NO write policies. Safe to re-run.

CREATE TABLE IF NOT EXISTS class_catch_up_forms (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id           uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  -- The absence the Slack link was for (Pacific date); null when filled out from the sidebar.
  absence_date        date,
  missed_blocks       text NOT NULL CHECK (char_length(missed_blocks) BETWEEN 1 AND 2000),
  lectures_missed     text NOT NULL CHECK (char_length(lectures_missed) BETWEEN 1 AND 5000),
  lecture_links       text NOT NULL CHECK (char_length(lecture_links) BETWEEN 1 AND 5000),
  assignments_missed  text NOT NULL CHECK (char_length(assignments_missed) BETWEEN 1 AND 5000),
  makeup_plan         text NOT NULL CHECK (char_length(makeup_plan) BETWEEN 1 AND 5000),
  notes               text CHECK (notes IS NULL OR char_length(notes) <= 5000),
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  -- How many instructors the follow-up Slack DM reached.
  instructors_notified integer NOT NULL DEFAULT 0,
  followed_up_at      timestamptz,
  followed_up_by      uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_class_catch_up_forms_course ON class_catch_up_forms(course_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_catch_up_forms_student ON class_catch_up_forms(student_id, submitted_at DESC);

ALTER TABLE class_catch_up_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own or staff class_catch_up_forms" ON class_catch_up_forms;
CREATE POLICY "read own or staff class_catch_up_forms"
  ON class_catch_up_forms FOR SELECT
  USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff'))
    OR EXISTS (
      SELECT 1 FROM course_enrollments ce
      WHERE ce.user_id = auth.uid() AND ce.course_id = class_catch_up_forms.course_id AND ce.role = 'ta'
    )
  );

GRANT ALL ON TABLE public.class_catch_up_forms TO anon;
GRANT ALL ON TABLE public.class_catch_up_forms TO authenticated;
GRANT ALL ON TABLE public.class_catch_up_forms TO service_role;

-- Sent-log for the absence DM: one row per student per absent (Pacific) day, written
-- before the DM goes out so a second cron run is a no-op.
CREATE TABLE IF NOT EXISTS class_absence_alerts (
  student_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  absence_date  date NOT NULL,
  course_id     uuid REFERENCES courses(id) ON DELETE SET NULL,
  blocks        text[] NOT NULL DEFAULT '{}',
  slack_sent    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, absence_date)
);

CREATE INDEX IF NOT EXISTS idx_class_absence_alerts_course ON class_absence_alerts(course_id, absence_date);

ALTER TABLE class_absence_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read class_absence_alerts" ON class_absence_alerts;
CREATE POLICY "staff read class_absence_alerts"
  ON class_absence_alerts FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

GRANT ALL ON TABLE public.class_absence_alerts TO anon;
GRANT ALL ON TABLE public.class_absence_alerts TO authenticated;
GRANT ALL ON TABLE public.class_absence_alerts TO service_role;
