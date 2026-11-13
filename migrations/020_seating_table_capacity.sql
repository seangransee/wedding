-- Seating chart: a configurable number of seats per round table.
--
-- The layout row's table_capacity is the "Seats per table" setting on the
-- floor plan. Changing it updates every round table's capacity, and new round
-- tables start with it. The sweetheart table always seats 2. Safe to rerun.

ALTER TABLE wedding_seating_layout
  ADD COLUMN IF NOT EXISTS table_capacity INTEGER NOT NULL DEFAULT 12
  CHECK (table_capacity BETWEEN 1 AND 30);
