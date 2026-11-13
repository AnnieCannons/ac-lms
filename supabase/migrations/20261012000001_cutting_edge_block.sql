-- Cutting Edge Talks: optional schedule block (the day is split into blocks A–D). A label
-- shown to students only — it doesn't change the time or who's invited. Safe to re-run.
ALTER TABLE cutting_edge_events
  ADD COLUMN IF NOT EXISTS block text CHECK (block IN ('A', 'B', 'C', 'D'));
