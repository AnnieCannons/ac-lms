-- Step 5: Cross-cutting / Admin
-- Partner interactions log, department journey status, student referrals
-- Also: apprenticeship partner type, linkedin/website on contacts

-- Add apprenticeship to partner_type enum
ALTER TYPE partner_type ADD VALUE IF NOT EXISTS 'apprenticeship';

-- Add admissions_referral to partner_type enum (listed in PRD §4.1 but missing from step2)
ALTER TYPE partner_type ADD VALUE IF NOT EXISTS 'admissions_referral';

-- Add linkedin and website to partner_contacts
ALTER TABLE partner_contacts
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS website_url  text;

-- Department enum used by both partner_department_status and partner_interactions
DO $$ BEGIN
  CREATE TYPE partner_department AS ENUM (
    'student_success',
    'career_development',
    'resourcefull',
    'funding_partnerships',
    'admissions'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Per-department journey stage for each partner
-- Each row = one (partner, department) pair with a free-text stage label
CREATE TABLE IF NOT EXISTS partner_department_status (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  department   partner_department NOT NULL,
  stage        text NOT NULL DEFAULT '',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (partner_id, department)
);

CREATE OR REPLACE FUNCTION update_partner_dept_status_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER partner_dept_status_updated_at
  BEFORE UPDATE ON partner_department_status
  FOR EACH ROW EXECUTE FUNCTION update_partner_dept_status_updated_at();

-- Interaction log: timestamped notes per partner, optionally scoped to a department
CREATE TABLE IF NOT EXISTS partner_interactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  department   partner_department,
  note         text NOT NULL,
  interaction_date date NOT NULL DEFAULT current_date,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Student referrals
DO $$ BEGIN
  CREATE TYPE referral_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS student_referrals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- anonymized student identifier (no PII stored here)
  student_identifier text NOT NULL,
  direction          referral_direction NOT NULL,
  partner_id         uuid REFERENCES partners(id) ON DELETE SET NULL,
  referral_date      date NOT NULL DEFAULT current_date,
  referral_type      text,               -- e.g. housing, legal, mental health
  outcome_rating     smallint CHECK (outcome_rating BETWEEN 1 AND 5),
  outcome_notes      text,
  student_city       text,
  open_to_relocation boolean,
  is_veteran         boolean NOT NULL DEFAULT false,
  is_neurodivergent  boolean NOT NULL DEFAULT false,
  other_flags        text[] NOT NULL DEFAULT '{}',
  logged_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_student_referrals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER student_referrals_updated_at
  BEFORE UPDATE ON student_referrals
  FOR EACH ROW EXECUTE FUNCTION update_student_referrals_updated_at();

-- RLS
ALTER TABLE partner_department_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_interactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_referrals         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff and admin manage partner_department_status"
  ON partner_department_status FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'admin')
  ));

CREATE POLICY "staff and admin manage partner_interactions"
  ON partner_interactions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'admin')
  ));

CREATE POLICY "staff and admin manage student_referrals"
  ON student_referrals FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'admin')
  ));

-- Grants
GRANT ALL ON partner_department_status TO authenticated, service_role;
GRANT ALL ON partner_interactions      TO authenticated, service_role;
GRANT ALL ON student_referrals         TO authenticated, service_role;
GRANT SELECT ON partner_department_status TO anon;
GRANT SELECT ON partner_interactions      TO anon;
GRANT SELECT ON student_referrals         TO anon;
