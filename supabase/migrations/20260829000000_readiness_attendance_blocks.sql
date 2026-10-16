-- Tracks raw attendance block counts alongside attendance_pct_missed so the UI
-- can show "X of Y blocks missed" (not just the percentage) without lossy
-- back-calculation from a rounded percentage.
ALTER TABLE student_stats_snapshots
  ADD COLUMN IF NOT EXISTS blocks_missed int,
  ADD COLUMN IF NOT EXISTS blocks_total  int;
