-- Widen partner_interactions.reminder_at from date to timestamptz so staff can
-- pick an exact date+time for a Slack follow-up reminder, not just a day.
-- Existing rows are date-only and become midnight UTC — fine, they're just
-- historical display data, not re-used for scheduling after the fact.
ALTER TABLE partner_interactions ALTER COLUMN reminder_at TYPE timestamptz USING reminder_at::timestamptz;

GRANT SELECT, INSERT, UPDATE, DELETE ON partner_interactions TO anon, authenticated, service_role;
