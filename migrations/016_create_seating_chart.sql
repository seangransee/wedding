-- Seating chart: one resizable room rectangle, any number of 12-person round
-- tables plus exactly one 2-person sweetheart table, at most one table per
-- invitation (party), and optional exact seats for the people in each party.
-- Positions and sizes are in room units (1 unit = 1 CSS pixel at 100% zoom);
-- table x/y are centers. Safe to rerun.

CREATE TABLE IF NOT EXISTS wedding_seating_layout (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  room_width INTEGER NOT NULL DEFAULT 1400 CHECK (room_width BETWEEN 480 AND 6000),
  room_height INTEGER NOT NULL DEFAULT 1000 CHECK (room_height BETWEEN 360 AND 6000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO wedding_seating_layout (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- number and name are free-form labels typed by the couple; either may be blank.
CREATE TABLE IF NOT EXISTS wedding_seating_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('round', 'sweetheart')),
  number TEXT NOT NULL DEFAULT '' CHECK (length(number) <= 12),
  name TEXT NOT NULL DEFAULT '' CHECK (length(name) <= 40),
  capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 30),
  x INTEGER NOT NULL CHECK (x BETWEEN 0 AND 6000),
  y INTEGER NOT NULL CHECK (y BETWEEN 0 AND 6000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wedding_seating_tables_one_sweetheart_idx
  ON wedding_seating_tables (kind)
  WHERE kind = 'sweetheart';

CREATE TABLE IF NOT EXISTS wedding_seating_assignments (
  guest_id INTEGER PRIMARY KEY REFERENCES wedding_guests(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES wedding_seating_tables(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wedding_seating_assignments_table_idx
  ON wedding_seating_assignments (table_id, assigned_at);

-- Optional exact seats: person_position is the 1-based person within the
-- party (matching wedding_rsvp_attendees.position for confirmed guests).
-- Seats belong to the party's current table and are cleared when it moves.
CREATE TABLE IF NOT EXISTS wedding_seating_seats (
  table_id UUID NOT NULL REFERENCES wedding_seating_tables(id) ON DELETE CASCADE,
  seat_number INTEGER NOT NULL CHECK (seat_number BETWEEN 1 AND 30),
  guest_id INTEGER NOT NULL REFERENCES wedding_seating_assignments(guest_id) ON DELETE CASCADE,
  person_position INTEGER NOT NULL CHECK (person_position BETWEEN 1 AND 10),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (table_id, seat_number),
  UNIQUE (guest_id, person_position)
);

-- Create the sweetheart table once, at the top center of the default room, and
-- seat the couple's own invitation there when it exists. Guarded so reruns
-- never recreate it or re-seat the couple after an admin moves them.
DO $$
DECLARE
  sweetheart_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM wedding_seating_tables WHERE kind = 'sweetheart') THEN
    INSERT INTO wedding_seating_tables (kind, name, capacity, x, y)
    VALUES ('sweetheart', 'Sweetheart table', 2, 700, 96)
    RETURNING id INTO sweetheart_id;

    INSERT INTO wedding_seating_assignments (guest_id, table_id)
    SELECT id, sweetheart_id
    FROM wedding_guests
    WHERE lower(btrim(name)) = 'sean and lexi'
    ORDER BY sort_order, id
    LIMIT 1
    ON CONFLICT (guest_id) DO NOTHING;
  END IF;
END;
$$;
