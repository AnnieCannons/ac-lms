-- Historical deals: imported records that count toward the funnel, placements
-- and fees but are left out of every sales-cycle timing stat.

ALTER TABLE partner_sales_deals
  ADD COLUMN IF NOT EXISTS is_historical boolean NOT NULL DEFAULT false;

-- Same as before, except a historical deal keeps whatever close date it was
-- given (possibly none) instead of being stamped with today.
CREATE OR REPLACE FUNCTION set_partner_sales_deals_closed_on()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stage IN ('closed_won', 'closed_lost') THEN
    IF NEW.closed_on IS NULL AND NOT NEW.is_historical THEN
      NEW.closed_on := CURRENT_DATE;
    END IF;
  ELSE
    NEW.closed_on := NULL;
  END IF;
  RETURN NEW;
END;
$$;
