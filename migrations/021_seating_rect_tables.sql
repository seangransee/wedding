-- Seating chart: rectangular tables.
--
-- Rows with kind = 'rect' are resizable rectangular tables. Unlike round
-- tables, each keeps its own capacity (the "Seats per table" setting only
-- changes round tables), and width/height store its size in room units
-- (x/y stay the center). Round, sweetheart, and bucket rows leave width and
-- height null. Safe to rerun.

ALTER TABLE wedding_seating_tables
  ADD COLUMN IF NOT EXISTS width INTEGER CHECK (width IS NULL OR width BETWEEN 60 AND 6000);

ALTER TABLE wedding_seating_tables
  ADD COLUMN IF NOT EXISTS height INTEGER CHECK (height IS NULL OR height BETWEEN 60 AND 6000);

ALTER TABLE wedding_seating_tables
  DROP CONSTRAINT IF EXISTS wedding_seating_tables_kind_check;

ALTER TABLE wedding_seating_tables
  ADD CONSTRAINT wedding_seating_tables_kind_check
  CHECK (kind IN ('round', 'sweetheart', 'rect', 'bucket'));

ALTER TABLE wedding_seating_tables
  DROP CONSTRAINT IF EXISTS wedding_seating_tables_rect_size_check;

ALTER TABLE wedding_seating_tables
  ADD CONSTRAINT wedding_seating_tables_rect_size_check
  CHECK (kind <> 'rect' OR (width IS NOT NULL AND height IS NOT NULL));
