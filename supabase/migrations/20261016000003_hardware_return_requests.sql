-- Hardware Tracker, Phase 3a: chasing loaned devices back.
-- One row per device we are waiting on. Created when staff mark a loaned device
-- "awaiting return" (e.g. the student dropped), closed when it is received or confirmed
-- lost. "Days waiting" and the 60-day "likely lost" flag come from requested_at.
-- next_reminder_at / reminder_count are filled in now (first reminder 48 hours later) and
-- used by the reminder cron in a later phase.
-- See _plans/hardware-tracker-roadmap.md.
--
-- Writes go through role-checked server actions with the service-role client, so there
-- are deliberately NO insert/update/delete policies. Safe to re-run.

CREATE TABLE IF NOT EXISTS hardware_return_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id         uuid NOT NULL REFERENCES hardware_devices(id) ON DELETE CASCADE,
  student_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at      timestamptz NOT NULL DEFAULT now(),
  requested_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  next_reminder_at  timestamptz,
  reminder_count    int NOT NULL DEFAULT 0,
  closed_at         timestamptz,
  closed_reason     text CHECK (closed_reason IS NULL OR closed_reason IN ('received', 'lost', 'cancelled')),
  CHECK ((closed_at IS NULL) = (closed_reason IS NULL))
);

-- At most one open request per device.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hardware_return_requests_open
  ON hardware_return_requests(device_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hardware_return_requests_student ON hardware_return_requests(student_id);

ALTER TABLE hardware_return_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read hardware_return_requests" ON hardware_return_requests;
CREATE POLICY "staff read hardware_return_requests"
  ON hardware_return_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

GRANT ALL ON TABLE public.hardware_return_requests TO anon;
GRANT ALL ON TABLE public.hardware_return_requests TO authenticated;
GRANT ALL ON TABLE public.hardware_return_requests TO service_role;
