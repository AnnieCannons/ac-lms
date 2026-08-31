-- Card content is stored as HTML strings (output of Tiptap's getHTML()),
-- not Tiptap JSON. Alter columns from jsonb to text to match the editor.
ALTER TABLE public.cards
  ALTER COLUMN front_content TYPE text USING front_content::text,
  ALTER COLUMN back_content  TYPE text USING back_content::text;

-- Update defaults to empty string instead of empty JSON object
ALTER TABLE public.cards
  ALTER COLUMN front_content SET DEFAULT '',
  ALTER COLUMN back_content  SET DEFAULT '';
