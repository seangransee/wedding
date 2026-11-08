-- Seating chart: bubbles.
--
-- A bubble is a small, unnamed bucket made by dropping someone on empty floor
-- (inside or outside the room), so anywhere can be a staging area. It is a
-- wedding_seating_tables row with kind = 'bucket' and bubble = true, so it
-- uses the same assignment rows as buckets. The app deletes a bubble once
-- nobody is in it. Safe to rerun.

ALTER TABLE wedding_seating_tables
  ADD COLUMN IF NOT EXISTS bubble BOOLEAN NOT NULL DEFAULT false;
