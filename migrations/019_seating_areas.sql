-- Seating chart: named floor areas.
--
-- Rectangles drawn on the floor plan for things that aren't tables, like the
-- stage and the dance floor. x/y is the top-left corner and width/height the
-- size, all in room units (1 unit = 1 CSS pixel at 100% zoom). Areas stay
-- inside the room. Nobody sits in an area. Safe to rerun.

CREATE TABLE IF NOT EXISTS wedding_seating_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '' CHECK (length(name) <= 40),
  x INTEGER NOT NULL CHECK (x BETWEEN 0 AND 6000),
  y INTEGER NOT NULL CHECK (y BETWEEN 0 AND 6000),
  width INTEGER NOT NULL CHECK (width BETWEEN 40 AND 6000),
  height INTEGER NOT NULL CHECK (height BETWEEN 40 AND 6000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
