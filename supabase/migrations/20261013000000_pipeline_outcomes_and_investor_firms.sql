-- Sales pipeline KPIs move from dollar values to partnership outcomes, and
-- venture capital / private equity firms get their own tracking: the portfolio
-- companies they introduce (linked on the introduced company's deal) and their
-- engagement with AC's LP strategy.

-- New partner types for investor firms.
ALTER TYPE partner_type ADD VALUE IF NOT EXISTS 'venture_capital';
ALTER TYPE partner_type ADD VALUE IF NOT EXISTS 'private_equity';

-- Deals: outcomes replace estimated value.
ALTER TABLE partner_sales_deals DROP COLUMN IF EXISTS estimated_value;

ALTER TABLE partner_sales_deals
  ADD COLUMN IF NOT EXISTS engagement_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hosts_apprentice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS funds_ac boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS introduced_by_partner_id uuid,
  ADD COLUMN IF NOT EXISTS introduced_on date;

ALTER TABLE partner_sales_deals DROP CONSTRAINT IF EXISTS partner_sales_deals_engagement_types_check;
ALTER TABLE partner_sales_deals ADD CONSTRAINT partner_sales_deals_engagement_types_check
  CHECK (engagement_types <@ ARRAY['mentorship', 'guest_speaking', 'cutting_edge_talks']::text[]);

ALTER TABLE partner_sales_deals DROP CONSTRAINT IF EXISTS partner_sales_deals_introduced_by_partner_id_fkey;
ALTER TABLE partner_sales_deals ADD CONSTRAINT partner_sales_deals_introduced_by_partner_id_fkey
  FOREIGN KEY (introduced_by_partner_id) REFERENCES partners(id) ON DELETE SET NULL;

ALTER TABLE partner_sales_deals DROP CONSTRAINT IF EXISTS partner_sales_deals_not_self_introduced;
ALTER TABLE partner_sales_deals ADD CONSTRAINT partner_sales_deals_not_self_introduced
  CHECK (introduced_by_partner_id IS NULL OR introduced_by_partner_id <> partner_id);

CREATE INDEX IF NOT EXISTS idx_partner_sales_deals_introduced_by
  ON partner_sales_deals (introduced_by_partner_id) WHERE introduced_by_partner_id IS NOT NULL;

-- Investor firms: one row per VC/PE partner, created the first time its LP status is set.
CREATE TABLE IF NOT EXISTS partner_investor_firms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  uuid NOT NULL UNIQUE REFERENCES partners(id) ON DELETE CASCADE,
  lp_status   text NOT NULL DEFAULT 'not_discussed'
    CHECK (lp_status IN ('not_discussed', 'introduced', 'in_discussion', 'engaged', 'declined')),
  lp_notes    text,
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_partner_investor_firms_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_investor_firms_updated_at ON partner_investor_firms;
CREATE TRIGGER partner_investor_firms_updated_at
  BEFORE UPDATE ON partner_investor_firms
  FOR EACH ROW EXECUTE FUNCTION update_partner_investor_firms_updated_at();

ALTER TABLE partner_investor_firms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff and admin manage partner_investor_firms" ON partner_investor_firms;
CREATE POLICY "staff and admin manage partner_investor_firms"
  ON partner_investor_firms FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'admin')
  ));

GRANT ALL ON partner_investor_firms TO authenticated, service_role;
