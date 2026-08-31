-- Add blank_index to cards table for cloze card type.
-- Cloze cards create one row per blank in the sentence; blank_index identifies
-- which blank (0-indexed) this row targets. NULL for non-cloze card types.
ALTER TABLE cards ADD COLUMN IF NOT EXISTS blank_index integer;
