-- Weekly readiness score (attendance + backlog) and the escalation workflow triggered when
-- a student's score stays low, per the student-accountability feature.

-- Extend the existing weekly snapshot with the new readiness inputs/output.
ALTER TABLE student_stats_snapshots
  ADD COLUMN IF NOT EXISTS attendance_pct_missed numeric,
  ADD COLUMN IF NOT EXISTS readiness_score        numeric;

-- Students can read their own snapshot rows (previously instructor/staff/admin only).
CREATE POLICY "student read own student_stats_snapshots"
  ON student_stats_snapshots FOR SELECT
  USING (student_id = auth.uid());

-- Current escalation state per (student, course) -- one live row, advanced weekly by the
-- readiness-score cron.
CREATE TABLE IF NOT EXISTS escalation_states (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id              uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status                 text NOT NULL DEFAULT 'none'
                           CHECK (status IN ('none', 'step1', 'step2', 'step3', 'resolved')),
  step_started_at        timestamptz,
  reminder_sent_at       timestamptz,
  zone_at_step_start     text CHECK (zone_at_step_start IN ('red', 'yellow', 'green')),
  consecutive_good_weeks int NOT NULL DEFAULT 0,
  grace_week_used        boolean NOT NULL DEFAULT false,
  trigger_reason         text CHECK (trigger_reason IN ('red_zone', 'yellow_zone_pattern')),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

CREATE OR REPLACE FUNCTION update_escalation_states_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER escalation_states_updated_at
  BEFORE UPDATE ON escalation_states
  FOR EACH ROW EXECUTE FUNCTION update_escalation_states_updated_at();

-- Append-only history of everything that happened during an escalation -- the "easy to see
-- history" requirement.
CREATE TABLE IF NOT EXISTS escalation_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id    uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  week_start   date,
  event_type   text NOT NULL CHECK (event_type IN (
                 'triggered', 'step1_sent', 'step1_reminder', 'step1_completed',
                 'advanced_to_step2', 'step2_sent', 'step2_reminder', 'step2_completed',
                 'advanced_to_step3', 'step3_sent', 'reset', 'manual_note'
               )),
  score        numeric,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalation_events_student_course
  ON escalation_events (student_id, course_id, created_at);

-- Step 1 (acknowledgment) and step 2 (structured reflection) form responses.
CREATE TABLE IF NOT EXISTS accountability_checkins (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id           uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  escalation_event_id uuid REFERENCES escalation_events(id) ON DELETE SET NULL,
  form_type           text NOT NULL CHECK (form_type IN ('acknowledgment', 'reflection')),
  note                text,
  goals               text,
  reflection          text,
  obstacles           text,
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accountability_checkins_student_course
  ON accountability_checkins (student_id, course_id, submitted_at);

-- RLS
ALTER TABLE escalation_states       ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE accountability_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "instructor staff admin read escalation_states"
  ON escalation_states FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('instructor', 'staff', 'admin')
  ));

CREATE POLICY "instructor staff admin read escalation_events"
  ON escalation_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('instructor', 'staff', 'admin')
  ));

CREATE POLICY "student read own escalation_events"
  ON escalation_events FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "instructor staff admin read accountability_checkins"
  ON accountability_checkins FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('instructor', 'staff', 'admin')
  ));

CREATE POLICY "student read own accountability_checkins"
  ON accountability_checkins FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "student insert own accountability_checkins"
  ON accountability_checkins FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Grants
GRANT SELECT ON TABLE public.escalation_states TO authenticated;
GRANT ALL    ON TABLE public.escalation_states TO service_role;
GRANT SELECT ON TABLE public.escalation_states TO anon;

GRANT SELECT ON TABLE public.escalation_events TO authenticated;
GRANT ALL    ON TABLE public.escalation_events TO service_role;
GRANT SELECT ON TABLE public.escalation_events TO anon;

GRANT SELECT, INSERT ON TABLE public.accountability_checkins TO authenticated;
GRANT ALL             ON TABLE public.accountability_checkins TO service_role;
GRANT SELECT          ON TABLE public.accountability_checkins TO anon;
