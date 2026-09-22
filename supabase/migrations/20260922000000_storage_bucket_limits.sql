-- Enforce upload size/type limits at the storage layer.
--
-- /api/upload no longer receives file bytes (Vercel rejects function bodies
-- over 4.5 MB, which broke larger screenshots). It now authorizes the upload
-- and returns a signed upload URL; the browser sends the file straight to
-- Supabase. The route's size/type checks only see what the client claims, so
-- the buckets themselves must enforce the real limits. Keep these in sync with
-- MAX_FILE_SIZE_BYTES / ALLOWED_MIME_* in src/app/api/upload/route.ts.
--
-- No GRANT changes: this only updates rows in storage.buckets.

UPDATE storage.buckets
SET file_size_limit = 20 * 1024 * 1024,
    allowed_mime_types = ARRAY[
      'image/*',
      'video/*',
      'audio/*',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip'
    ]
WHERE id IN ('lms-submissions', 'lms-resources');

-- Avatars: AvatarUpload.tsx allows JPG/PNG/WebP up to 5 MB
UPDATE storage.buckets
SET file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'avatars';
