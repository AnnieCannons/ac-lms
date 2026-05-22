-- STEP 2: Run this after step 1 has been committed.
-- Enums for partners (drop first in case a previous partial run created them)
DROP TYPE IF EXISTS partner_status;
DROP TYPE IF EXISTS partner_type;
CREATE TYPE partner_status AS ENUM ('prospect', 'active', 'inactive', 'in_onboarding');
CREATE TYPE partner_type AS ENUM ('service_provider', 'corporate', 'funder', 'advisory', 'mentorship', 'media');

-- Base partner/organization record
CREATE TABLE partners (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  city                 text,
  state                text,
  multi_city           boolean NOT NULL DEFAULT false,
  how_we_met           text,
  services_focus_area  text,
  status               partner_status NOT NULL DEFAULT 'prospect',
  last_interaction_date date,
  meeting_notes        text,
  tags                 text[] NOT NULL DEFAULT '{}',
  internal_owner_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  referred_by          text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Junction table: one row per (partner, type) pair
CREATE TABLE partner_type_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  partner_type partner_type NOT NULL,
  UNIQUE (partner_id, partner_type)
);

-- Contacts for each partner (primary + additional)
CREATE TABLE partner_contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name         text NOT NULL,
  title        text,
  email        text,
  phone        text,
  is_primary   boolean NOT NULL DEFAULT false,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at on partners
CREATE OR REPLACE FUNCTION update_partners_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_partners_updated_at();

-- RLS
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_type_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_contacts ENABLE ROW LEVEL SECURITY;

-- Staff and admin can read/write all partner data; instructors have no access
CREATE POLICY "staff and admin can manage partners"
  ON partners FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
    )
  );

CREATE POLICY "staff and admin can manage partner_type_assignments"
  ON partner_type_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
    )
  );

CREATE POLICY "staff and admin can manage partner_contacts"
  ON partner_contacts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('staff', 'admin')
    )
  );
