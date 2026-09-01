-- Chunk 1: Schema support for deck update notifications and diff/merge flow

-- 1. Add source_card_id to cards (tracks which original card an imported card came from)
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS source_card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL;

-- 2. Add updated_at to cards, backfill from created_at
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.cards SET updated_at = created_at WHERE updated_at = now();

-- Trigger to auto-update updated_at on every row update
CREATE OR REPLACE FUNCTION public.set_card_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cards_set_updated_at ON public.cards;
CREATE TRIGGER cards_set_updated_at
  BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.set_card_updated_at();

-- 3. Add deck_id to notifications so the bell can route to the right deck
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS deck_id uuid REFERENCES public.decks(id) ON DELETE CASCADE;

-- 4. Snapshot table — stores what was pushed so the diff reflects the push, not later edits
CREATE TABLE IF NOT EXISTS public.deck_update_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id  uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  source_card_id   uuid,          -- no FK: card may be deleted, snapshot still queryable
  front_content    text NOT NULL DEFAULT '',
  back_content     text NOT NULL DEFAULT '',
  card_type        text NOT NULL DEFAULT 'basic',
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS: importers can only read snapshots for their own notifications
ALTER TABLE public.deck_update_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own deck update snapshots"
  ON public.deck_update_snapshots FOR SELECT
  USING (
    notification_id IN (
      SELECT id FROM public.notifications WHERE user_id = auth.uid()
    )
  );
