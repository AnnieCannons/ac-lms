-- Store submission files as storage paths instead of public URLs, ahead of
-- making the lms-submissions bucket private.
--
-- RUN THIS ONLY AFTER the code that reads paths is deployed. The app reads
-- both forms (old public URLs and bare paths), so this is cleanup, not a
-- requirement — but older code can't read bare paths.
--
-- File-type `content` is either one URL or a JSON array of URLs, e.g.
--   https://<project>.supabase.co/storage/v1/object/public/lms-submissions/<assignment>/<student>/shot.png
-- becomes
--   <assignment>/<student>/shot.png
-- Stripping the prefix handles both shapes. Rows with percent-encoding or a
-- query string are skipped (none existed on 2026-10-15); the app still reads
-- those as URLs.
--
-- Idempotent: once a row is converted it no longer matches the WHERE clause.
-- No GRANT changes: only updates existing rows.

UPDATE submissions
SET content = regexp_replace(
  content,
  'https?://[^"/]+/storage/v1/object/public/lms-submissions/',
  '',
  'g'
)
WHERE submission_type = 'file'
  AND content LIKE '%/storage/v1/object/public/lms-submissions/%'
  AND content !~ '%[0-9A-Fa-f]{2}'
  AND content NOT LIKE '%?%';

UPDATE submission_history
SET content = regexp_replace(
  content,
  'https?://[^"/]+/storage/v1/object/public/lms-submissions/',
  '',
  'g'
)
WHERE submission_type = 'file'
  AND content LIKE '%/storage/v1/object/public/lms-submissions/%'
  AND content !~ '%[0-9A-Fa-f]{2}'
  AND content NOT LIKE '%?%';

-- Check: storage policies that mention this bucket. Once the bucket is
-- private, any SELECT (or ALL) policy here would still let logged-in users
-- download files directly, around the app's own check. Uploads use signed
-- upload URLs and need no policy. Expect zero rows; if any show up, they
-- should be reviewed and dropped before flipping the bucket to private.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (
    coalesce(qual, '') LIKE '%lms-submissions%'
    OR coalesce(with_check, '') LIKE '%lms-submissions%'
    -- read policies that don't name any bucket apply to this one too
    OR (cmd IN ('SELECT', 'ALL') AND coalesce(qual, '') NOT LIKE '%bucket_id%')
  );
