ALTER TABLE public.accommodations
  ADD COLUMN IF NOT EXISTS camera_off_start date,
  ADD COLUMN IF NOT EXISTS camera_off_end date;
