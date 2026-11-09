-- Sales pipeline for corporate partners: one deal per partner, tracking where
-- the partner sits in the sales funnel. Corporate partners with no row yet are
-- shown in the 'lead' stage; a row is created the first time one is moved or edited.

CREATE TABLE IF NOT EXISTS partner_sales_deals (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id           uuid NOT NULL UNIQUE REFERENCES partners(id) ON DELETE CASCADE,
  stage                text NOT NULL DEFAULT 'lead'
    CHECK (stage IN ('lead', 'contacted', 'meeting_held', 'proposal_sent', 'negotiation', 'closed_won', 'closed_lost')),
  estimated_value      numeric(12, 2) CHECK (estimated_value IS NULL OR estimated_value >= 0),
  expected_close_date  date,
  notes                text,
  updated_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_sales_deals_stage ON partner_sales_deals (stage);

CREATE OR REPLACE FUNCTION update_partner_sales_deals_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_sales_deals_updated_at ON partner_sales_deals;
CREATE TRIGGER partner_sales_deals_updated_at
  BEFORE UPDATE ON partner_sales_deals
  FOR EACH ROW EXECUTE FUNCTION update_partner_sales_deals_updated_at();

ALTER TABLE partner_sales_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff and admin manage partner_sales_deals" ON partner_sales_deals;
CREATE POLICY "staff and admin manage partner_sales_deals"
  ON partner_sales_deals FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'admin')
  ));

GRANT ALL ON partner_sales_deals TO authenticated, service_role;
