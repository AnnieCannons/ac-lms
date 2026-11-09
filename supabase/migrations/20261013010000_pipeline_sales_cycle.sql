-- Sales cycle tracking: when a deal entered the pipeline and when it closed,
-- so the pipeline can report time from introduction (or pipeline entry) to close.

ALTER TABLE partner_sales_deals
  ADD COLUMN IF NOT EXISTS started_on date,
  ADD COLUMN IF NOT EXISTS closed_on date;

-- Backfill in one statement: the right-hand sides read the row as it was,
-- before the updated_at trigger bumps it.
UPDATE partner_sales_deals
  SET started_on = COALESCE(started_on, created_at::date),
      closed_on = CASE
        WHEN stage IN ('closed_won', 'closed_lost') THEN COALESCE(closed_on, updated_at::date)
        ELSE NULL
      END
  WHERE started_on IS NULL
     OR (stage IN ('closed_won', 'closed_lost') AND closed_on IS NULL);

ALTER TABLE partner_sales_deals ALTER COLUMN started_on SET DEFAULT CURRENT_DATE;

-- closed_on is only meaningful for closed deals: fill it in when a deal closes
-- without one (the app normally sends the user's local date), and clear it when
-- a deal is reopened.
CREATE OR REPLACE FUNCTION set_partner_sales_deals_closed_on()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stage IN ('closed_won', 'closed_lost') THEN
    IF NEW.closed_on IS NULL THEN
      NEW.closed_on := CURRENT_DATE;
    END IF;
  ELSE
    NEW.closed_on := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_sales_deals_closed_on ON partner_sales_deals;
CREATE TRIGGER partner_sales_deals_closed_on
  BEFORE INSERT OR UPDATE ON partner_sales_deals
  FOR EACH ROW EXECUTE FUNCTION set_partner_sales_deals_closed_on();
