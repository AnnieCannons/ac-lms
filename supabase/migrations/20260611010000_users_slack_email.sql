-- Optional override email for Slack lookups.
-- Used when a user's LMS login email differs from the email on their Slack
-- account (e.g. login jakki@anniecannons.com but Slack jaybee@anniecannons.com),
-- which otherwise causes users.lookupByEmail to fail and DMs to be dropped.
-- When set, Slack reminders/notifications use this instead of the login email.
ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_email TEXT;

-- No GRANT changes needed: the new column inherits the users table's existing
-- table-level privileges. (Re-granting to anon would broaden access here.)
