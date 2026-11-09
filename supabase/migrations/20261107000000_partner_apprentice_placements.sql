-- Apprentices placed with a corporate partner, by term (January, May, September
-- of a given year). One row per partner + term + year holding the number placed.

CREATE TABLE IF NOT EXISTS partner_apprentice_placements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  term        text NOT NULL CHECK (term IN ('january', 'may', 'september')),
  year        integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  count       integer NOT NULL CHECK (count > 0),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_id, term, year)
);

CREATE INDEX IF NOT EXISTS idx_partner_apprentice_placements_partner
  ON partner_apprentice_placements (partner_id);

ALTER TABLE partner_apprentice_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff and admin manage partner_apprentice_placements" ON partner_apprentice_placements;
CREATE POLICY "staff and admin manage partner_apprentice_placements"
  ON partner_apprentice_placements FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'admin')
  ));

GRANT ALL ON partner_apprentice_placements TO authenticated, service_role;
