-- Change assignments.due_date from timestamptz to date
-- All stored values are midnight UTC so casting to date is lossless
ALTER TABLE assignments ALTER COLUMN due_date TYPE date USING due_date::date;

-- Store the student's IANA timezone at submission time and whether it was late
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS student_timezone TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT false;

GRANT ALL ON TABLE assignments TO authenticated, service_role;
GRANT SELECT ON TABLE assignments TO anon;
GRANT ALL ON TABLE submissions TO authenticated, service_role;
GRANT SELECT ON TABLE submissions TO anon;
