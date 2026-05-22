-- Add emailed_at to notifications so the daily digest cron can track what's been sent
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS notifications_emailed_at
  ON notifications(emailed_at)
  WHERE emailed_at IS NULL;
