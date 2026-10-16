-- Hardware Tracker, Phase 1: loaner laptops, hotspots and wifi boosters, the purchases they
-- came from, and an append-only history of everything that happens to them.
-- See _plans/hardware-tracker-roadmap.md.
--
-- No shipping addresses are stored anywhere in these tables (PII stays in Airtable).
--
-- Every write goes through server actions using the service-role client after an explicit
-- instructor/staff/admin check, so there are deliberately NO insert/update/delete policies.
-- Safe to re-run.

-- LMS asset tags (LAP-001, HOT-001, BOOST-001), one counter per kind. Boosters have no
-- manufacturer number, so the tag is the only way to tell them apart.
CREATE SEQUENCE IF NOT EXISTS hardware_laptop_tag_seq;
CREATE SEQUENCE IF NOT EXISTS hardware_hotspot_tag_seq;
CREATE SEQUENCE IF NOT EXISTS hardware_booster_tag_seq;

-- One row per purchase (e.g. 20 refurbished laptops, same model and year).
CREATE TABLE IF NOT EXISTS hardware_purchase_batches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              text NOT NULL CHECK (kind IN ('laptop', 'hotspot', 'booster')),
  purchased_on      date,
  vendor            text,
  make_model        text,
  model_year        int CHECK (model_year IS NULL OR model_year BETWEEN 2000 AND 2100),
  condition         text CHECK (condition IS NULL OR condition IN ('new', 'refurbished', 'used')),
  unit_cost         numeric(10, 2) CHECK (unit_cost IS NULL OR unit_cost >= 0),
  warranty_ends_on  date,
  notes             text,
  created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hardware_devices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind               text NOT NULL CHECK (kind IN ('laptop', 'hotspot', 'booster')),
  asset_tag          text UNIQUE,
  serial_number      text,
  imei               text,
  iccid              text,
  phone_number       text,
  -- Copied from the purchase batch at creation so a single device can be corrected later.
  make_model         text,
  model_year         int CHECK (model_year IS NULL OR model_year BETWEEN 2000 AND 2100),
  condition          text CHECK (condition IS NULL OR condition IN ('new', 'refurbished', 'used')),
  purchase_batch_id  uuid REFERENCES hardware_purchase_batches(id) ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'in_stock' CHECK (status IN (
                       'in_stock', 'on_loan', 'owned_by_student', 'awaiting_return',
                       'received', 'needs_prep', 'needs_repair', 'lost', 'retired')),
  current_holder_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  notes              text,
  created_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Serial numbers and IMEIs identify one physical device, so no two rows may share one
-- (compared case-insensitively, ignoring surrounding spaces).
CREATE UNIQUE INDEX IF NOT EXISTS uq_hardware_devices_serial
  ON hardware_devices (lower(btrim(serial_number))) WHERE serial_number IS NOT NULL AND btrim(serial_number) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_hardware_devices_imei
  ON hardware_devices (btrim(imei)) WHERE imei IS NOT NULL AND btrim(imei) <> '';
CREATE INDEX IF NOT EXISTS idx_hardware_devices_holder ON hardware_devices(current_holder_id);
CREATE INDEX IF NOT EXISTS idx_hardware_devices_status ON hardware_devices(status);
CREATE INDEX IF NOT EXISTS idx_hardware_devices_batch ON hardware_devices(purchase_batch_id);

CREATE OR REPLACE FUNCTION hardware_devices_set_asset_tag()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.asset_tag IS NULL OR btrim(NEW.asset_tag) = '' THEN
    NEW.asset_tag := CASE NEW.kind
      WHEN 'laptop'  THEN 'LAP-'   || lpad(nextval('hardware_laptop_tag_seq')::text, 3, '0')
      WHEN 'hotspot' THEN 'HOT-'   || lpad(nextval('hardware_hotspot_tag_seq')::text, 3, '0')
      WHEN 'booster' THEN 'BOOST-' || lpad(nextval('hardware_booster_tag_seq')::text, 3, '0')
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hardware_devices_asset_tag ON hardware_devices;
CREATE TRIGGER trg_hardware_devices_asset_tag
  BEFORE INSERT ON hardware_devices
  FOR EACH ROW EXECUTE FUNCTION hardware_devices_set_asset_tag();

-- Append-only history. A row is about a device, a student, or both (a charger replacement
-- has no device). This is what the device and student history timelines show.
CREATE TABLE IF NOT EXISTS hardware_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   uuid REFERENCES hardware_devices(id) ON DELETE CASCADE,
  student_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  type        text NOT NULL,
  notes       text,
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (device_id IS NOT NULL OR student_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_hardware_events_device ON hardware_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hardware_events_student ON hardware_events(student_id, created_at DESC);

ALTER TABLE hardware_purchase_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read hardware_purchase_batches" ON hardware_purchase_batches;
CREATE POLICY "staff read hardware_purchase_batches"
  ON hardware_purchase_batches FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

DROP POLICY IF EXISTS "staff read hardware_devices" ON hardware_devices;
CREATE POLICY "staff read hardware_devices"
  ON hardware_devices FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

DROP POLICY IF EXISTS "staff read hardware_events" ON hardware_events;
CREATE POLICY "staff read hardware_events"
  ON hardware_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

GRANT ALL ON TABLE public.hardware_purchase_batches TO anon;
GRANT ALL ON TABLE public.hardware_purchase_batches TO authenticated;
GRANT ALL ON TABLE public.hardware_purchase_batches TO service_role;
GRANT ALL ON TABLE public.hardware_devices TO anon;
GRANT ALL ON TABLE public.hardware_devices TO authenticated;
GRANT ALL ON TABLE public.hardware_devices TO service_role;
GRANT ALL ON TABLE public.hardware_events TO anon;
GRANT ALL ON TABLE public.hardware_events TO authenticated;
GRANT ALL ON TABLE public.hardware_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE hardware_laptop_tag_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE hardware_hotspot_tag_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE hardware_booster_tag_seq TO authenticated, service_role;
