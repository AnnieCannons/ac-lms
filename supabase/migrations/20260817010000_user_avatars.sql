-- Profile photos: users can upload an avatar from their account page.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- No GRANT changes needed: the new column inherits the users table's existing
-- table-level privileges.

-- Storage bucket for avatar images. Public so <img> tags can load them directly
-- without signed URLs; the upload API route (not bucket policy) enforces that a
-- user can only write to their own avatars/<user id>/ path.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
