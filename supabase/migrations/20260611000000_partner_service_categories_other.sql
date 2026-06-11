ALTER TABLE partners ADD COLUMN IF NOT EXISTS service_categories_other TEXT;

GRANT ALL ON partners TO anon, authenticated, service_role;
