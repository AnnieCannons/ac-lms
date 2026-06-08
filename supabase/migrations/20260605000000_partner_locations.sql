-- Multiple locations per partner
-- Replaces the single city/state columns for partners that operate across multiple locations.
-- The partners.city and partners.state columns are kept for backward compatibility with list views;
-- they are synced with the first partner_locations row on save.

CREATE TABLE IF NOT EXISTS partner_locations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  city       text,
  state      text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE partner_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff and admin manage partner_locations"
  ON partner_locations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'admin')
  ));

GRANT ALL ON partner_locations TO authenticated, service_role;
GRANT SELECT ON partner_locations TO anon;
