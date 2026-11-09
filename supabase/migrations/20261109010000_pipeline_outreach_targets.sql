-- Outreach targets: how many companies of each size to add to the pipeline over
-- a period. A company counts toward a target when its deal's company_segment
-- matches and its started_on ("Entered pipeline") falls within the period;
-- progress is computed in src/lib/sales-pipeline.ts, nothing stored.

ALTER TABLE partner_sales_deals
  ADD COLUMN IF NOT EXISTS company_segment text;

ALTER TABLE partner_sales_deals DROP CONSTRAINT IF EXISTS partner_sales_deals_company_segment_check;
ALTER TABLE partner_sales_deals ADD CONSTRAINT partner_sales_deals_company_segment_check
  CHECK (company_segment IN ('growth_stage', 'enterprise'));

CREATE TABLE IF NOT EXISTS partner_outreach_targets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment       text NOT NULL CHECK (segment IN ('growth_stage', 'enterprise')),
  target_count  integer NOT NULL CHECK (target_count BETWEEN 1 AND 10000),
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_outreach_targets_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_partner_outreach_targets_end_date ON partner_outreach_targets (end_date);

CREATE OR REPLACE FUNCTION update_partner_outreach_targets_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_outreach_targets_updated_at ON partner_outreach_targets;
CREATE TRIGGER partner_outreach_targets_updated_at
  BEFORE UPDATE ON partner_outreach_targets
  FOR EACH ROW EXECUTE FUNCTION update_partner_outreach_targets_updated_at();

ALTER TABLE partner_outreach_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff and admin manage partner_outreach_targets" ON partner_outreach_targets;
CREATE POLICY "staff and admin manage partner_outreach_targets"
  ON partner_outreach_targets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'admin')
  ));

GRANT ALL ON partner_outreach_targets TO authenticated, service_role;

-- Starting targets for the next six months: 20 growth stage and 5 enterprise companies.
-- Only added when the table is empty, so re-running this never duplicates them.
INSERT INTO partner_outreach_targets (segment, target_count, start_date, end_date)
SELECT v.segment, v.target_count, DATE '2026-11-09', DATE '2027-05-08'
FROM (VALUES ('growth_stage', 20), ('enterprise', 5)) AS v(segment, target_count)
WHERE NOT EXISTS (SELECT 1 FROM partner_outreach_targets);
