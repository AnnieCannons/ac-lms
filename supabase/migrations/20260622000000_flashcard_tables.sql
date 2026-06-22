-- Flashcard app tables
-- Run in Supabase SQL Editor or via Supabase CLI.

-- ----------------------------------------------------------------
-- Helper: auto-update updated_at on row change
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------
-- decks
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.decks (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title            text        NOT NULL,
  description      text,
  share_token      text        UNIQUE,
  is_shared        boolean     NOT NULL DEFAULT false,
  tags             text[]      NOT NULL DEFAULT '{}',
  original_deck_id uuid        REFERENCES public.decks(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER decks_set_updated_at
  BEFORE UPDATE ON public.decks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_decks_owner      ON public.decks(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_decks_share_token ON public.decks(share_token) WHERE share_token IS NOT NULL;

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read: own decks"
  ON public.decks FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "read: shared decks"
  ON public.decks FOR SELECT TO authenticated
  USING (is_shared = true);

CREATE POLICY "write: own decks"
  ON public.decks FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "read: staff see all decks"
  ON public.decks FOR SELECT TO authenticated
  USING (public.is_staff());

GRANT ALL ON TABLE public.decks TO anon;
GRANT ALL ON TABLE public.decks TO authenticated;
GRANT ALL ON TABLE public.decks TO service_role;

COMMENT ON TABLE public.decks IS 'Flashcard decks owned by users. Shared decks are readable by all authenticated users via share_token.';


-- ----------------------------------------------------------------
-- cards
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cards (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id         uuid        NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  card_type       text        NOT NULL CHECK (card_type IN ('basic', 'type_in', 'cloze', 'image_occlusion')),
  front_content   jsonb       NOT NULL DEFAULT '{}',
  back_content    jsonb       NOT NULL DEFAULT '{}',
  audio_url       text,
  image_url       text,
  occlusion_zones jsonb,
  "order"         int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON public.cards(deck_id);

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Readable if you own the deck or the deck is shared
CREATE POLICY "read: own or shared deck cards"
  ON public.cards FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.decks d
      WHERE d.id = public.cards.deck_id
        AND (d.owner_user_id = auth.uid() OR d.is_shared = true)
    )
  );

CREATE POLICY "write: own deck cards"
  ON public.cards FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.decks d
      WHERE d.id = public.cards.deck_id AND d.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.decks d
      WHERE d.id = public.cards.deck_id AND d.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "read: staff see all cards"
  ON public.cards FOR SELECT TO authenticated
  USING (public.is_staff());

GRANT ALL ON TABLE public.cards TO anon;
GRANT ALL ON TABLE public.cards TO authenticated;
GRANT ALL ON TABLE public.cards TO service_role;

COMMENT ON TABLE public.cards IS 'Individual flashcards. front_content and back_content are Tiptap JSON (jsonb).';


-- ----------------------------------------------------------------
-- card_progress
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.card_progress (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  card_id           uuid        NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  state             text        NOT NULL DEFAULT 'new' CHECK (state IN ('new', 'in_progress', 'review')),
  interval          int         NOT NULL DEFAULT 0,
  easiness_factor   numeric     NOT NULL DEFAULT 2.5,
  due_date          date        NOT NULL DEFAULT current_date,
  last_reviewed_at  timestamptz,
  UNIQUE (user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_card_progress_user_id ON public.card_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_card_progress_due     ON public.card_progress(user_id, due_date);

ALTER TABLE public.card_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read/write: own progress"
  ON public.card_progress FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "read: staff see all progress"
  ON public.card_progress FOR SELECT TO authenticated
  USING (public.is_staff());

GRANT ALL ON TABLE public.card_progress TO anon;
GRANT ALL ON TABLE public.card_progress TO authenticated;
GRANT ALL ON TABLE public.card_progress TO service_role;

COMMENT ON TABLE public.card_progress IS 'SM-2 state per user per card. One row per (user_id, card_id) pair.';


-- ----------------------------------------------------------------
-- study_sessions
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  deck_id        uuid        NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  started_at     timestamptz NOT NULL DEFAULT now(),
  ended_at       timestamptz,
  cards_studied  int         NOT NULL DEFAULT 0,
  cards_again    int         NOT NULL DEFAULT 0,
  cards_hard     int         NOT NULL DEFAULT 0,
  cards_good     int         NOT NULL DEFAULT 0,
  cards_easy     int         NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON public.study_sessions(user_id);

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read/write: own sessions"
  ON public.study_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "read: staff see all sessions"
  ON public.study_sessions FOR SELECT TO authenticated
  USING (public.is_staff());

GRANT ALL ON TABLE public.study_sessions TO anon;
GRANT ALL ON TABLE public.study_sessions TO authenticated;
GRANT ALL ON TABLE public.study_sessions TO service_role;

COMMENT ON TABLE public.study_sessions IS 'Records each study session with per-rating card counts.';


-- ----------------------------------------------------------------
-- badges
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.badges (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text    NOT NULL,
  description    text    NOT NULL,
  icon_url       text    NOT NULL,
  trigger_type   text    NOT NULL,
  trigger_value  int     NOT NULL,
  is_active      boolean NOT NULL DEFAULT true
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read: authenticated"
  ON public.badges FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "write: staff only"
  ON public.badges FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

GRANT ALL ON TABLE public.badges TO anon;
GRANT ALL ON TABLE public.badges TO authenticated;
GRANT ALL ON TABLE public.badges TO service_role;

COMMENT ON TABLE public.badges IS 'Predefined badge definitions. Managed by staff only.';


-- ----------------------------------------------------------------
-- user_badges
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_badges (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id   uuid        NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read: own badges"
  ON public.user_badges FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "read: staff see all badges"
  ON public.user_badges FOR SELECT TO authenticated
  USING (public.is_staff());

-- Awarded by server-side logic via service role — no direct user writes

GRANT ALL ON TABLE public.user_badges TO anon;
GRANT ALL ON TABLE public.user_badges TO authenticated;
GRANT ALL ON TABLE public.user_badges TO service_role;

COMMENT ON TABLE public.user_badges IS 'Badges earned by users. Inserted via service role; not user-writable.';


-- ----------------------------------------------------------------
-- activity_log
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date                date        NOT NULL,
  cards_studied_count int         NOT NULL DEFAULT 0,
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_date ON public.activity_log(user_id, date DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read/write: own activity"
  ON public.activity_log FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "read: staff see all activity"
  ON public.activity_log FOR SELECT TO authenticated
  USING (public.is_staff());

GRANT ALL ON TABLE public.activity_log TO anon;
GRANT ALL ON TABLE public.activity_log TO authenticated;
GRANT ALL ON TABLE public.activity_log TO service_role;

COMMENT ON TABLE public.activity_log IS 'Daily card study counts per user. Powers the GitHub-style activity grid. Upserted at end of each study session.';
