-- Hardware Tracker, Phase 8: Equipment Support Form tickets.
-- When a student submits the Airtable Equipment Support Form, an Airtable automation posts
-- the issue (NOT the shipping address, which stays in Airtable) to /api/webhooks/hardware-ticket.
-- The LMS matches the student by email and the device by equipment type, stores a ticket,
-- and posts it in #student-hardware. See _plans/hardware-tracker-roadmap.md.
--
-- Writes go through the secret-checked webhook or role-checked server actions with the
-- service-role client, so there are deliberately NO write policies. Safe to re-run.

CREATE TABLE IF NOT EXISTS hardware_tickets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The Airtable record (where the address lives); unique so a re-sent webhook is a no-op.
  airtable_record_id  text UNIQUE,
  airtable_url        text,
  submitted_email     text,
  submitted_name      text,
  equipment_type      text,
  issue               text,
  other_info          text,
  student_id          uuid REFERENCES users(id) ON DELETE SET NULL,
  device_id           uuid REFERENCES hardware_devices(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'replacement_sent', 'resolved')),
  -- Any staff update; open tickets untouched for 48 hours get a nudge in Slack.
  last_activity_at    timestamptz NOT NULL DEFAULT now(),
  last_nudged_at      timestamptz,
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hardware_tickets_status ON hardware_tickets(status, last_activity_at);
CREATE INDEX IF NOT EXISTS idx_hardware_tickets_student ON hardware_tickets(student_id);
CREATE INDEX IF NOT EXISTS idx_hardware_tickets_device ON hardware_tickets(device_id);

ALTER TABLE hardware_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read hardware_tickets" ON hardware_tickets;
CREATE POLICY "staff read hardware_tickets"
  ON hardware_tickets FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

GRANT ALL ON TABLE public.hardware_tickets TO anon;
GRANT ALL ON TABLE public.hardware_tickets TO authenticated;
GRANT ALL ON TABLE public.hardware_tickets TO service_role;
