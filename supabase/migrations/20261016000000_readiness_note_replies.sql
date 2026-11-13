-- Readiness note replies: a back-and-forth thread under a readiness note that was shared
-- with the student. The student and staff (instructor/staff/admin) can both reply while the
-- note is shared; each author can edit or delete their own reply, and admins can delete any.
-- Deleting the note deletes its replies.
--
-- Like readiness_notes, every read and write goes through server actions using the
-- service-role client after an explicit role / ownership check, so there are deliberately NO
-- policies for anon/authenticated. Safe to re-run.

CREATE TABLE IF NOT EXISTS readiness_note_replies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     uuid NOT NULL REFERENCES readiness_notes(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  body        text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readiness_note_replies_note
  ON readiness_note_replies(note_id, created_at);

ALTER TABLE readiness_note_replies ENABLE ROW LEVEL SECURITY;

GRANT ALL ON readiness_note_replies TO anon, authenticated, service_role;

-- Bell notifications for replies carry both the note (so they go with the note, and the
-- staff bell can link to the student's page) and the reply (so deleting the reply removes
-- its notification).
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS readiness_note_reply_id uuid REFERENCES readiness_note_replies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_readiness_note_reply_id_idx
  ON notifications(readiness_note_reply_id) WHERE readiness_note_reply_id IS NOT NULL;
