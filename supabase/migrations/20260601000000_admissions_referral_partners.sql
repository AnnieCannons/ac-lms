-- Admissions referral partner additions
-- Adds only_inbound flag to partners, airtable_record_id for deduplication,
-- and admissions_applications table for linking to Airtable application records

-- ─── partners additions ───────────────────────────────────────────────────────

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS only_inbound boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS airtable_record_id text;

-- Unique index so re-running the import script doesn't create duplicates
CREATE UNIQUE INDEX IF NOT EXISTS partners_airtable_record_id_idx
  ON partners (airtable_record_id)
  WHERE airtable_record_id IS NOT NULL;

-- ─── admissions_applications ──────────────────────────────────────────────────
-- Stores a pointer to each application record in Airtable.
-- No PII is stored here — application data is fetched from Airtable on demand.

CREATE TABLE IF NOT EXISTS admissions_applications (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id         uuid        NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  airtable_record_id text        NOT NULL UNIQUE,
  student_identifier text,       -- anonymized identifier only (e.g. preferred name)
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ─── Grants ───────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON admissions_applications TO authenticated;
GRANT ALL                            ON admissions_applications TO service_role;
GRANT SELECT                         ON admissions_applications TO anon;
