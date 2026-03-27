-- Confidence Tracker: skills students are tracking
CREATE TABLE IF NOT EXISTS confidence_skills (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual confidence log entries per skill
CREATE TABLE IF NOT EXISTS confidence_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id    UUID NOT NULL REFERENCES confidence_skills(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
  goal_points INTEGER CHECK (goal_points >= 1 AND goal_points <= 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: students can only access their own data
ALTER TABLE confidence_skills  ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_own_skills"   ON confidence_skills
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "students_own_entries"  ON confidence_entries
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS confidence_skills_user   ON confidence_skills(user_id);
CREATE INDEX IF NOT EXISTS confidence_entries_skill  ON confidence_entries(skill_id);
CREATE INDEX IF NOT EXISTS confidence_entries_user   ON confidence_entries(user_id);
