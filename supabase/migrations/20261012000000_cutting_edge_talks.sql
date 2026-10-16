-- Cutting Edge Talks: global guest-speaker events, managed in one place instead of an
-- "Upcoming Cutting Edge Talks" module copied into every course. Each event owns its two
-- checkbox assignments ("Submit Your Question in Advance" and "Say Thank You & Build
-- Bridges") as columns — they are NOT course assignments, so they never touch the
-- gradebook, missing/late counts or readiness.
--
-- Every write goes through server actions using the service-role client after an explicit
-- role/enrollment check, so there are deliberately NO insert/update/delete policies.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS cutting_edge_events (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  text NOT NULL CHECK (length(btrim(title)) > 0),
  speaker                text,
  starts_at              timestamptz NOT NULL,
  location_text          text,
  location_url           text,
  about_html             text,
  -- true = every student in a course active at the time (start_date → end_date, or
  -- start_date + 105 days); false = only the courses in cutting_edge_event_courses.
  audience_all           boolean NOT NULL DEFAULT true,
  status                 text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  -- Set once, the first time the event is published; the "new event" RSVP prompt is sent
  -- only then, never on later edits or re-publishing.
  first_published_at     timestamptz,

  -- Pacific calendar dates (no time of day).
  question_due_date      date NOT NULL,
  question_html          text,
  question_padlet_url    text,
  thanks_due_date        date NOT NULL,
  thanks_html            text,
  thanks_padlet_url      text,

  created_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cutting_edge_events_starts_at
  ON cutting_edge_events(starts_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS cutting_edge_event_courses (
  event_id   uuid NOT NULL REFERENCES cutting_edge_events(id) ON DELETE CASCADE,
  course_id  uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_cutting_edge_event_courses_course ON cutting_edge_event_courses(course_id);

-- One row per student per event: RSVP plus completion of the two assignments.
CREATE TABLE IF NOT EXISTS cutting_edge_rsvps (
  event_id          uuid NOT NULL REFERENCES cutting_edge_events(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response          text CHECK (response IN ('yes', 'no')),
  question_done_at  timestamptz,
  thanks_done_at    timestamptz,
  -- "I did not make it": excuses the thank-you; shown on the report as "said yes, missed".
  missed_at         timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- Set when staff override a student's row from the report.
  updated_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (event_id, user_id),
  CHECK (thanks_done_at IS NULL OR missed_at IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_cutting_edge_rsvps_user ON cutting_edge_rsvps(user_id);

-- One row per notification actually sent, so a re-run cron (or a re-publish) never sends
-- the same reminder twice.
CREATE TABLE IF NOT EXISTS cutting_edge_notifications_sent (
  event_id  uuid NOT NULL REFERENCES cutting_edge_events(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind      text NOT NULL CHECK (kind IN ('new_event', 'question_reminder', 'thanks_reminder')),
  sent_at   timestamptz NOT NULL DEFAULT now(),
  slack_sent boolean NOT NULL DEFAULT false,
  PRIMARY KEY (event_id, user_id, kind)
);

-- Bell notifications link to the event.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS cutting_edge_event_id uuid REFERENCES cutting_edge_events(id) ON DELETE CASCADE;

ALTER TABLE cutting_edge_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cutting_edge_event_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cutting_edge_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE cutting_edge_notifications_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read cutting_edge_events" ON cutting_edge_events;
CREATE POLICY "staff read cutting_edge_events"
  ON cutting_edge_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

DROP POLICY IF EXISTS "staff read cutting_edge_event_courses" ON cutting_edge_event_courses;
CREATE POLICY "staff read cutting_edge_event_courses"
  ON cutting_edge_event_courses FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

DROP POLICY IF EXISTS "students read own cutting_edge_rsvps, staff read all" ON cutting_edge_rsvps;
CREATE POLICY "students read own cutting_edge_rsvps, staff read all"
  ON cutting_edge_rsvps FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff'))
  );

DROP POLICY IF EXISTS "staff read cutting_edge_notifications_sent" ON cutting_edge_notifications_sent;
CREATE POLICY "staff read cutting_edge_notifications_sent"
  ON cutting_edge_notifications_sent FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

GRANT ALL ON TABLE public.cutting_edge_events TO anon;
GRANT ALL ON TABLE public.cutting_edge_events TO authenticated;
GRANT ALL ON TABLE public.cutting_edge_events TO service_role;
GRANT ALL ON TABLE public.cutting_edge_event_courses TO anon;
GRANT ALL ON TABLE public.cutting_edge_event_courses TO authenticated;
GRANT ALL ON TABLE public.cutting_edge_event_courses TO service_role;
GRANT ALL ON TABLE public.cutting_edge_rsvps TO anon;
GRANT ALL ON TABLE public.cutting_edge_rsvps TO authenticated;
GRANT ALL ON TABLE public.cutting_edge_rsvps TO service_role;
GRANT ALL ON TABLE public.cutting_edge_notifications_sent TO anon;
GRANT ALL ON TABLE public.cutting_edge_notifications_sent TO authenticated;
GRANT ALL ON TABLE public.cutting_edge_notifications_sent TO service_role;
