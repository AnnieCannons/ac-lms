-- Hardware Tracker, Phase 3b: laptop ownership, replacements and the waitlist.
-- See _plans/hardware-tracker-roadmap.md.
--
-- Writes go through role-checked server actions with the service-role client, so the new
-- tables have deliberately NO insert/update/delete policies. Safe to re-run.

-- Which courses count toward laptop ownership is read from the course name ("Tech Career
-- Foundations …" / "Intro to Programming …"), so no course column is needed. An earlier
-- draft of this migration added courses.laptop_track; it is unused, and dropped here if it
-- was applied.
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_laptop_track_check;
ALTER TABLE courses DROP COLUMN IF EXISTS laptop_track;

-- One laptop and one charger replacement per student (more needs an override note).
CREATE TABLE IF NOT EXISTS hardware_replacements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind              text NOT NULL CHECK (kind IN ('laptop', 'charger')),
  old_device_id     uuid REFERENCES hardware_devices(id) ON DELETE SET NULL,
  new_device_id     uuid REFERENCES hardware_devices(id) ON DELETE SET NULL,
  -- The old one is either on its way back to us or written off (lost/stolen/damaged).
  old_coming_back   boolean NOT NULL DEFAULT true,
  write_off_reason  text,
  -- Required when the student had already used their one replacement of this kind.
  override_note     text,
  notes             text,
  created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (old_coming_back OR write_off_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_hardware_replacements_student ON hardware_replacements(student_id);

-- Students waiting for a device; staff-only for now.
CREATE TABLE IF NOT EXISTS hardware_waitlist (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind                 text NOT NULL CHECK (kind IN ('laptop', 'hotspot', 'booster')),
  note                 text,
  added_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  added_at             timestamptz NOT NULL DEFAULT now(),
  fulfilled_at         timestamptz,
  fulfilled_device_id  uuid REFERENCES hardware_devices(id) ON DELETE SET NULL,
  removed_at           timestamptz
);

-- A student can only be waiting once per kind.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hardware_waitlist_open
  ON hardware_waitlist(student_id, kind) WHERE fulfilled_at IS NULL AND removed_at IS NULL;

ALTER TABLE hardware_replacements ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read hardware_replacements" ON hardware_replacements;
CREATE POLICY "staff read hardware_replacements"
  ON hardware_replacements FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

DROP POLICY IF EXISTS "staff read hardware_waitlist" ON hardware_waitlist;
CREATE POLICY "staff read hardware_waitlist"
  ON hardware_waitlist FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

GRANT ALL ON TABLE public.hardware_replacements TO anon;
GRANT ALL ON TABLE public.hardware_replacements TO authenticated;
GRANT ALL ON TABLE public.hardware_replacements TO service_role;
GRANT ALL ON TABLE public.hardware_waitlist TO anon;
GRANT ALL ON TABLE public.hardware_waitlist TO authenticated;
GRANT ALL ON TABLE public.hardware_waitlist TO service_role;
