-- Security audit follow-ups (PR #196 "Needs a decision"), storage part. Idempotent.
-- No GRANT changes: this only updates storage.buckets rows and storage.objects policies.

-- ─── 1. lms-submissions: raster images only (no SVG) ────────────────────────────────
-- An SVG can carry script. Same list as everything in 20260922000000, with 'image/*'
-- replaced by explicit raster types. Keep in sync with SUBMISSION_IMAGE_TYPES in
-- src/app/api/upload/route.ts. lms-resources (staff-only uploads) keeps 'image/*'.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'image/heic',
      'image/heif',
      'image/avif',
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
WHERE id = 'lms-submissions';

-- ─── 2. flashcard-images/: only the deck's owner (or staff) may upload ──────────────
-- 20260626000001 let any logged-in user upload anything under lms-resources/
-- flashcard-images/. The editor uploads to flashcard-images/<deckId>/<file>, so the
-- second folder must be a deck the uploader owns. Instructors/staff/admins keep access.
DROP POLICY IF EXISTS "Authenticated users can upload flashcard images" ON storage.objects;
DROP POLICY IF EXISTS "Deck owners can upload flashcard images" ON storage.objects;
CREATE POLICY "Deck owners can upload flashcard images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lms-resources'
    AND name LIKE 'flashcard-images/%'
    AND (
      EXISTS (
        SELECT 1 FROM public.decks d
        WHERE d.id::text = (storage.foldername(name))[2]
          AND d.owner_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role IN ('instructor', 'staff', 'admin')
      )
    )
  );
