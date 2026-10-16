-- Collapses the "triggered"/"advanced_to_stepN" + "stepN_sent" event pairs
-- (always logged in the same instant) into single stepN_started events.

-- Drop the old constraint first -- the data migration below writes values
-- ('step1_started' etc.) that the old constraint doesn't allow yet.
ALTER TABLE escalation_events DROP CONSTRAINT IF EXISTS escalation_events_event_type_check;

-- Migrate existing rows: the "triggered"/"advanced_to_stepN" half of each
-- pair is now redundant (its stepN_sent sibling becomes the single
-- stepN_started row), so drop it; then rename the stepN_sent rows themselves.
DELETE FROM escalation_events WHERE event_type IN ('triggered', 'advanced_to_step2', 'advanced_to_step3');
UPDATE escalation_events SET event_type = 'step1_started' WHERE event_type = 'step1_sent';
UPDATE escalation_events SET event_type = 'step2_started' WHERE event_type = 'step2_sent';
UPDATE escalation_events SET event_type = 'step3_started' WHERE event_type = 'step3_sent';

ALTER TABLE escalation_events ADD CONSTRAINT escalation_events_event_type_check CHECK (event_type IN (
  'step1_started', 'step1_reminder', 'step1_completed',
  'step2_started', 'step2_reminder', 'step2_completed',
  'step3_started',
  'reset', 'manual_note'
));
