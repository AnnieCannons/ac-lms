-- Create lms-resources bucket if it doesn't already exist (course editor also uses this bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lms-resources', 'lms-resources', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload images under the flashcard-images/ prefix
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload flashcard images'
  ) THEN
    CREATE POLICY "Authenticated users can upload flashcard images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'lms-resources' AND name LIKE 'flashcard-images/%');
  END IF;
END $$;

-- Public read access for flashcard images (bucket is public but explicit policy is good practice)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read access for flashcard images'
  ) THEN
    CREATE POLICY "Public read access for flashcard images"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'lms-resources' AND name LIKE 'flashcard-images/%');
  END IF;
END $$;
