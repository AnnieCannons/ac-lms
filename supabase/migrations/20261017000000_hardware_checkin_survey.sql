-- Hardware Tracker, Phase 6: the equipment check-in (launch survey). Staff send it to the
-- students in chosen courses plus anyone added by hand; students say which AnnieCannons
-- equipment they have (laptop serial, hotspot IMEI/phone, booster yes/no, past
-- replacements); staff review each answer, which creates or links the devices.
-- See _plans/hardware-tracker-roadmap.md.
--
-- Writes go through role-checked server actions with the service-role client (a student
-- may only write their own response), so there are deliberately NO write policies.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS hardware_surveys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL CHECK (length(btrim(title)) > 0),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Closed check-ins stop showing to students; answers and reviews are kept.
  closed_at   timestamptz
);

CREATE TABLE IF NOT EXISTS hardware_survey_recipients (
  survey_id    uuid NOT NULL REFERENCES hardware_surveys(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The course they were added through, or null when added individually.
  course_id    uuid REFERENCES courses(id) ON DELETE SET NULL,
  added_at     timestamptz NOT NULL DEFAULT now(),
  last_nudged_at timestamptz,
  PRIMARY KEY (survey_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_hardware_survey_recipients_user ON hardware_survey_recipients(user_id);

CREATE TABLE IF NOT EXISTS hardware_survey_responses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id         uuid NOT NULL REFERENCES hardware_surveys(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  has_laptop        boolean NOT NULL DEFAULT false,
  laptop_serial     text,
  has_hotspot       boolean NOT NULL DEFAULT false,
  hotspot_imei      text,
  hotspot_phone     text,
  has_booster       boolean NOT NULL DEFAULT false,
  laptop_replaced   boolean NOT NULL DEFAULT false,
  charger_replaced  boolean NOT NULL DEFAULT false,
  notes             text,
  submitted_at      timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- pending until staff approve (devices created/linked) or dismiss it.
  review_status     text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'dismissed')),
  reviewed_at       timestamptz,
  reviewed_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  review_note       text,
  UNIQUE (survey_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_hardware_survey_responses_status ON hardware_survey_responses(survey_id, review_status);

ALTER TABLE hardware_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware_survey_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware_survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read hardware_surveys" ON hardware_surveys;
CREATE POLICY "staff read hardware_surveys"
  ON hardware_surveys FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

DROP POLICY IF EXISTS "own or staff read hardware_survey_recipients" ON hardware_survey_recipients;
CREATE POLICY "own or staff read hardware_survey_recipients"
  ON hardware_survey_recipients FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff'))
  );

DROP POLICY IF EXISTS "own or staff read hardware_survey_responses" ON hardware_survey_responses;
CREATE POLICY "own or staff read hardware_survey_responses"
  ON hardware_survey_responses FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff'))
  );

GRANT ALL ON TABLE public.hardware_surveys TO anon;
GRANT ALL ON TABLE public.hardware_surveys TO authenticated;
GRANT ALL ON TABLE public.hardware_surveys TO service_role;
GRANT ALL ON TABLE public.hardware_survey_recipients TO anon;
GRANT ALL ON TABLE public.hardware_survey_recipients TO authenticated;
GRANT ALL ON TABLE public.hardware_survey_recipients TO service_role;
GRANT ALL ON TABLE public.hardware_survey_responses TO anon;
GRANT ALL ON TABLE public.hardware_survey_responses TO authenticated;
GRANT ALL ON TABLE public.hardware_survey_responses TO service_role;
