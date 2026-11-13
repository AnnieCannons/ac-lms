-- Bell notifications for shared readiness notes link to the note, so the notification goes
-- away with it: deleting the note removes it (ON DELETE CASCADE), and unsharing the note
-- deletes it in readiness-notes-actions.ts. Safe to re-run.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS readiness_note_id uuid REFERENCES readiness_notes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_readiness_note_id_idx
  ON notifications(readiness_note_id) WHERE readiness_note_id IS NOT NULL;
