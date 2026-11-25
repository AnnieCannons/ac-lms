-- Let submissions and resources take Windows-labelled zips, PowerPoint and tar/gz.
--
-- Chrome/Edge on Windows send a .zip as application/x-zip-compressed, which the
-- buckets refused (only application/zip was allowed), so Windows students
-- couldn't turn in zipped code. The file picker also offered .ppt/.pptx/.tar/.gz,
-- but no bucket allowed those types, so they failed partway through upload.
-- Keep in sync with ALLOWED_MIME_EXACT in src/app/api/upload/route.ts.
--
-- Idempotent: appends only the types a bucket doesn't already have, and leaves
-- each bucket's existing list (e.g. lms-submissions' raster-only images) alone.
-- No GRANT changes: this only updates rows in storage.buckets.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY(
  SELECT DISTINCT unnest(
    allowed_mime_types || ARRAY[
      'application/x-zip-compressed',
      'application/x-zip',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/x-tar',
      'application/gzip',
      'application/x-gzip'
    ]
  )
)
WHERE id IN ('lms-submissions', 'lms-resources');
