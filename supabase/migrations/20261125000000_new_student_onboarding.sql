-- New Student Onboarding (Enrollment Readiness courses, shipping, wifi choices, Comcast NOW).
-- See _plans/new-student-onboarding-roadmap.md. Idempotent: safe to run more than once.

-- ── Enrollment Readiness courses and what counts toward finishing ────────────────────────
-- Copied when a course is duplicated, like every other course/assignment column.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS is_enrollment_readiness boolean NOT NULL DEFAULT false;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS counts_toward_onboarding boolean NOT NULL DEFAULT true;

-- Where an Enrollment Readiness cohort goes next (usually a Tech Career Foundations course).
-- Per cohort, so the duplicate route resets it.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS onboarding_next_course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL;

-- ── Hardware: what each student needs ────────────────────────────────────────────────────
-- No row = needs a laptop, wifi None.
CREATE TABLE IF NOT EXISTS public.hardware_student_needs (
  student_id  uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  laptop      text NOT NULL DEFAULT 'needs' CHECK (laptop IN ('needs', 'own')),
  wifi        text NOT NULL DEFAULT 'none' CHECK (wifi IN ('none', 'comcast_now', 'booster', 'hotspot')),
  updated_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Hardware: shipments (one box, one tracking number). No addresses are stored. ─────────
CREATE TABLE IF NOT EXISTS public.hardware_shipments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_ids       uuid[] NOT NULL DEFAULT '{}',
  carrier          text NOT NULL CHECK (carrier IN ('usps', 'ups', 'fedex', 'other')),
  tracking_number  text NOT NULL CHECK (length(btrim(tracking_number)) > 0),
  shipped_on       date NOT NULL,
  received_at      timestamptz,
  received_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  notes            text,
  created_by       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hardware_shipments_student ON public.hardware_shipments(student_id, shipped_on DESC);
CREATE INDEX IF NOT EXISTS idx_hardware_shipments_devices ON public.hardware_shipments USING gin (device_ids);

-- ── Hardware: Comcast NOW plans AnnieCannons pays for each month ─────────────────────────
CREATE TABLE IF NOT EXISTS public.hardware_internet_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider        text NOT NULL DEFAULT 'Comcast NOW',
  account_number  text,
  monthly_cost    numeric(10, 2),
  starts_on       date NOT NULL,
  ends_on         date,
  notes           text,
  created_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS idx_hardware_internet_plans_student ON public.hardware_internet_plans(student_id);

-- ── Security: staff read; every write goes through role-checked server actions ──────────
ALTER TABLE public.hardware_student_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_internet_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read hardware_student_needs" ON public.hardware_student_needs;
CREATE POLICY "staff read hardware_student_needs"
  ON public.hardware_student_needs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

DROP POLICY IF EXISTS "staff read hardware_shipments" ON public.hardware_shipments;
CREATE POLICY "staff read hardware_shipments"
  ON public.hardware_shipments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

DROP POLICY IF EXISTS "staff read hardware_internet_plans" ON public.hardware_internet_plans;
CREATE POLICY "staff read hardware_internet_plans"
  ON public.hardware_internet_plans FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('admin', 'instructor', 'staff')));

GRANT ALL ON TABLE public.hardware_student_needs TO anon;
GRANT ALL ON TABLE public.hardware_student_needs TO authenticated;
GRANT ALL ON TABLE public.hardware_student_needs TO service_role;
GRANT ALL ON TABLE public.hardware_shipments TO anon;
GRANT ALL ON TABLE public.hardware_shipments TO authenticated;
GRANT ALL ON TABLE public.hardware_shipments TO service_role;
GRANT ALL ON TABLE public.hardware_internet_plans TO anon;
GRANT ALL ON TABLE public.hardware_internet_plans TO authenticated;
GRANT ALL ON TABLE public.hardware_internet_plans TO service_role;

-- ── This year's course ───────────────────────────────────────────────────────────────────
-- "Enrollment Readiness (2027)" is an Enrollment Readiness course, and its "Receiving Your
-- Laptop" (done after the laptop arrives) doesn't count toward finishing. Later cohorts are
-- duplicated from it, so they inherit both. No-ops on any database without these rows.
UPDATE public.courses SET is_enrollment_readiness = true
  WHERE id = '807abb92-086a-4297-b561-9f1d88518110';
UPDATE public.assignments SET counts_toward_onboarding = false
  WHERE id = 'b387f744-1422-46f9-8636-523e660bc548';
