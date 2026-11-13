-- Hardware Tracker, Phase 7: hotspot plans and the daily reminders job.
-- See _plans/hardware-tracker-roadmap.md.
--
-- Writes go through role-checked server actions or the CRON_SECRET-protected cron route,
-- both using the service-role client, so there are deliberately NO write policies.
-- Safe to re-run.

-- One row per hotspot plan period (usually a year bought up front through Mission
-- Telecom). Renewing adds a new row, so past periods stay as history. The current plan is
-- the one with the latest end date.
CREATE TABLE IF NOT EXISTS hardware_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       uuid NOT NULL REFERENCES hardware_devices(id) ON DELETE CASCADE,
  carrier         text NOT NULL DEFAULT 'Mission Telecom',
  plan            text,
  starts_on       date NOT NULL,
  ends_on         date NOT NULL,
  cost            numeric(10, 2) CHECK (cost IS NULL OR cost >= 0),
  account_number  text,
  line_number     text,
  notes           text,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on > starts_on)
);

CREATE INDEX IF NOT EXISTS idx_hardware_subscriptions_device ON hardware_subscriptions(device_id, ends_on DESC);
CREATE INDEX IF NOT EXISTS idx_hardware_subscriptions_ends ON hardware_subscriptions(ends_on);

-- One row per alert the daily job has sent (e.g. "renewal:<subscription id>",
-- "graduates:2026-12-21"), so a re-run never sends the same alert twice.
CREATE TABLE IF NOT EXISTS hardware_alerts_sent (
  key      text PRIMARY KEY,
  sent_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hardware_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware_alerts_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read hardware_subscriptions" ON hardware_subscriptions;
CREATE POLICY "staff read hardware_subscriptions"
  ON hardware_subscriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

DROP POLICY IF EXISTS "staff read hardware_alerts_sent" ON hardware_alerts_sent;
CREATE POLICY "staff read hardware_alerts_sent"
  ON hardware_alerts_sent FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

GRANT ALL ON TABLE public.hardware_subscriptions TO anon;
GRANT ALL ON TABLE public.hardware_subscriptions TO authenticated;
GRANT ALL ON TABLE public.hardware_subscriptions TO service_role;
GRANT ALL ON TABLE public.hardware_alerts_sent TO anon;
GRANT ALL ON TABLE public.hardware_alerts_sent TO authenticated;
GRANT ALL ON TABLE public.hardware_alerts_sent TO service_role;
