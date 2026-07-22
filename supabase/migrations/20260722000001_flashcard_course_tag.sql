-- Add curriculum tag array to decks
ALTER TABLE public.decks
  ADD COLUMN IF NOT EXISTS course_tag text[] NOT NULL DEFAULT '{}';
