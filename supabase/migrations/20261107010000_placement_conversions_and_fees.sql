-- The sales pipeline now tracks hiring partners only: apprentices placed per
-- term, how many of them converted to a hire, and the placement fee for that
-- term. Run after 20261107000000_partner_apprentice_placements.sql.
--
-- The deal-level outcome columns (engagement_types, hosts_apprentice, funds_ac
-- on partner_sales_deals) are no longer used by the app but are deliberately
-- kept so the data already entered isn't lost.

ALTER TABLE partner_apprentice_placements
  ADD COLUMN IF NOT EXISTS converted_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS fee_status text NOT NULL DEFAULT 'not_invoiced';

ALTER TABLE partner_apprentice_placements DROP CONSTRAINT IF EXISTS partner_apprentice_placements_converted_count_check;
ALTER TABLE partner_apprentice_placements ADD CONSTRAINT partner_apprentice_placements_converted_count_check
  CHECK (converted_count >= 0 AND converted_count <= count);

ALTER TABLE partner_apprentice_placements DROP CONSTRAINT IF EXISTS partner_apprentice_placements_fee_amount_check;
ALTER TABLE partner_apprentice_placements ADD CONSTRAINT partner_apprentice_placements_fee_amount_check
  CHECK (fee_amount IS NULL OR fee_amount >= 0);

ALTER TABLE partner_apprentice_placements DROP CONSTRAINT IF EXISTS partner_apprentice_placements_fee_status_check;
ALTER TABLE partner_apprentice_placements ADD CONSTRAINT partner_apprentice_placements_fee_status_check
  CHECK (fee_status IN ('not_invoiced', 'invoiced', 'paid'));
