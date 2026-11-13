-- Referral sources: where a pipeline deal came from. A VC/PE introduction keeps
-- using introduced_by_partner_id; client and funding partner referrals carry a
-- typed-in name in referral_detail. introduced_on is the referral date for any source.

ALTER TABLE partner_sales_deals
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS referral_detail text;

UPDATE partner_sales_deals
  SET referral_source = 'vc_pe'
  WHERE introduced_by_partner_id IS NOT NULL AND referral_source IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partner_sales_deals_referral_source_check') THEN
    ALTER TABLE partner_sales_deals ADD CONSTRAINT partner_sales_deals_referral_source_check
      CHECK (referral_source IN (
        'vc_pe', 'client_referral', 'funding_partner', 'board_advisor', 'personal_network', 'event', 'inbound'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partner_sales_deals_referral_firm_check') THEN
    ALTER TABLE partner_sales_deals ADD CONSTRAINT partner_sales_deals_referral_firm_check
      CHECK (introduced_by_partner_id IS NULL OR referral_source = 'vc_pe');
  END IF;
END;
$$;
