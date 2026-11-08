-- Seating chart: split parties and unseated buckets.
--
-- Optional per-person seating: an invitation (party) can be split so each
-- person sits at their own table. A row in wedding_seating_splits marks the
-- party as split; while split it has no wedding_seating_assignments row, and
-- wedding_seating_person_assignments holds the table for each seated person
-- (people with no row are not seated). Seating the whole party at a table
-- again deletes the split row, which cascades to the per-person rows. Safe to
-- rerun.

CREATE TABLE IF NOT EXISTS wedding_seating_splits (
  guest_id INTEGER PRIMARY KEY REFERENCES wedding_guests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wedding_seating_person_assignments (
  guest_id INTEGER NOT NULL REFERENCES wedding_seating_splits(guest_id) ON DELETE CASCADE,
  person_position INTEGER NOT NULL CHECK (person_position BETWEEN 1 AND 10),
  table_id UUID NOT NULL REFERENCES wedding_seating_tables(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guest_id, person_position)
);

CREATE INDEX IF NOT EXISTS wedding_seating_person_assignments_table_idx
  ON wedding_seating_person_assignments (table_id, assigned_at);

-- Exact seats used to cascade from the whole-party assignment row. Split
-- people have no such row, so seats now hang off the guest instead and the
-- app clears them explicitly when someone moves or is unseated (reads also
-- ignore any seat whose person isn't at that table).
ALTER TABLE wedding_seating_seats
  DROP CONSTRAINT IF EXISTS wedding_seating_seats_guest_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wedding_seating_seats_guest_fk'
      AND conrelid = 'wedding_seating_seats'::regclass
  ) THEN
    ALTER TABLE wedding_seating_seats
      ADD CONSTRAINT wedding_seating_seats_guest_fk
      FOREIGN KEY (guest_id) REFERENCES wedding_guests(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Buckets: named holding areas for people who aren't seated yet (e.g. "Dad's
-- family"). They live in wedding_seating_tables with kind = 'bucket' so whole
-- parties and split people are put in them through the same assignment rows
-- as tables, but they never count as seated, have no exact seats, ignore
-- capacity, and their x/y is the top-left corner, which may sit outside the
-- room (so coordinates may be negative).
ALTER TABLE wedding_seating_tables
  DROP CONSTRAINT IF EXISTS wedding_seating_tables_kind_check;
ALTER TABLE wedding_seating_tables
  ADD CONSTRAINT wedding_seating_tables_kind_check
  CHECK (kind IN ('round', 'sweetheart', 'bucket'));

ALTER TABLE wedding_seating_tables
  DROP CONSTRAINT IF EXISTS wedding_seating_tables_x_check;
ALTER TABLE wedding_seating_tables
  ADD CONSTRAINT wedding_seating_tables_x_check CHECK (x BETWEEN -6000 AND 12000);

ALTER TABLE wedding_seating_tables
  DROP CONSTRAINT IF EXISTS wedding_seating_tables_y_check;
ALTER TABLE wedding_seating_tables
  ADD CONSTRAINT wedding_seating_tables_y_check CHECK (y BETWEEN -6000 AND 12000);
