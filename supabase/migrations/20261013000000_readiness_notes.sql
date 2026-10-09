-- Readiness notes: dated notes instructors/staff/admins leave on a student's Weekly
-- Readiness card (e.g. "Met about attendance"). Staff-only unless the author ticks
-- "Share with student" (visible_to_student), which also shows it on the student's own
-- Weekly Readiness page. Stored against the course the note was written in; reads follow the
-- readiness chain so TCF notes still show once the student moves on to ITP.
--
-- Every read and write goes through server actions using the service-role client after
-- an explicit role check, so there are deliberately NO policies for anon/authenticated.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS readiness_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  note_date   date NOT NULL,
  body        text NOT NULL CHECK (length(btrim(body)) > 0),
  visible_to_student boolean NOT NULL DEFAULT false,
  author_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readiness_notes_student_course
  ON readiness_notes(student_id, course_id);

ALTER TABLE readiness_notes ENABLE ROW LEVEL SECURITY;

GRANT ALL ON readiness_notes TO anon, authenticated, service_role;
