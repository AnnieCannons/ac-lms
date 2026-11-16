-- Adds 'step1_grace': logged when a step 1 student's score improves but isn't
-- green yet, so they get one more week before moving to step 2. Before this the
-- grace week left no trace in the history and nothing was posted to Slack.

ALTER TABLE escalation_events DROP CONSTRAINT IF EXISTS escalation_events_event_type_check;

ALTER TABLE escalation_events ADD CONSTRAINT escalation_events_event_type_check CHECK (event_type IN (
  'step1_started', 'step1_reminder', 'step1_completed', 'step1_grace',
  'step2_started', 'step2_reminder', 'step2_completed',
  'step3_started',
  'reset', 'manual_note'
));
