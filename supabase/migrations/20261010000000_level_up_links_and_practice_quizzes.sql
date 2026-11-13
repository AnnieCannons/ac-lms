-- Level Up Your Skills page: recommended course links on the platform cards
-- (Codecademy, freeCodeCamp, Udemy, Pluralsight, master.dev), plus practice quizzes.
--
-- course_id NULL = a shared link shown in every course; otherwise an extra for that one
-- course. Shared links are edited by instructors/staff/admins; per-course links also by
-- that course's TAs. All writes go through server actions (src/lib/level-up-actions.ts)
-- with the service client and their own role checks; the policies below are a backstop.

CREATE TABLE IF NOT EXISTS public.level_up_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  platform    text NOT NULL CHECK (platform IN ('codecademy', 'freecodecamp', 'udemy', 'pluralsight', 'masterdev', 'other')),
  title       text NOT NULL CHECK (length(trim(title)) > 0),
  url         text NOT NULL CHECK (url ~* '^https?://'),
  description text,
  "order"     integer NOT NULL DEFAULT 0,
  published   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS level_up_links_course_id_idx ON public.level_up_links(course_id);
CREATE INDEX IF NOT EXISTS level_up_links_platform_order_idx ON public.level_up_links(platform, "order");

ALTER TABLE public.level_up_links ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can read published links (they're just public course recommendations)
DROP POLICY IF EXISTS "level_up_links: read published" ON public.level_up_links;
CREATE POLICY "level_up_links: read published" ON public.level_up_links
  FOR SELECT TO authenticated
  USING (published OR public.is_staff());

DROP POLICY IF EXISTS "level_up_links: staff write" ON public.level_up_links;
CREATE POLICY "level_up_links: staff write" ON public.level_up_links
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

GRANT ALL ON TABLE public.level_up_links TO anon;
GRANT ALL ON TABLE public.level_up_links TO authenticated;
GRANT ALL ON TABLE public.level_up_links TO service_role;

-- Practice quizzes: ungraded, unlimited retakes, listed only under Level Up (not on the
-- Quizzes page, course outline or day pages), and never counted as missing.
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS is_practice boolean NOT NULL DEFAULT false;
