CREATE TABLE IF NOT EXISTS wedding_guests (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  guest_count INTEGER NOT NULL CHECK (guest_count BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wedding_rsvps (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guest_id INTEGER NOT NULL UNIQUE REFERENCES wedding_guests(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('yes', 'no', 'deciding')),
  attending_count INTEGER CHECK (attending_count BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status = 'yes' AND attending_count IS NOT NULL)
    OR (status IN ('no', 'deciding') AND attending_count IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS wedding_rsvp_attendees (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rsvp_id INTEGER NOT NULL REFERENCES wedding_rsvps(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 10),
  full_name TEXT NOT NULL CHECK (length(btrim(full_name)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rsvp_id, position)
);

CREATE INDEX IF NOT EXISTS wedding_rsvp_attendees_rsvp_id_idx
  ON wedding_rsvp_attendees (rsvp_id);

CREATE OR REPLACE FUNCTION set_wedding_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_wedding_guests_updated_at'
  ) THEN
    CREATE TRIGGER set_wedding_guests_updated_at
    BEFORE UPDATE ON wedding_guests
    FOR EACH ROW
    EXECUTE FUNCTION set_wedding_updated_at_timestamp();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_wedding_rsvps_updated_at'
  ) THEN
    CREATE TRIGGER set_wedding_rsvps_updated_at
    BEFORE UPDATE ON wedding_rsvps
    FOR EACH ROW
    EXECUTE FUNCTION set_wedding_updated_at_timestamp();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_wedding_rsvp_attendees_updated_at'
  ) THEN
    CREATE TRIGGER set_wedding_rsvp_attendees_updated_at
    BEFORE UPDATE ON wedding_rsvp_attendees
    FOR EACH ROW
    EXECUTE FUNCTION set_wedding_updated_at_timestamp();
  END IF;
END;
$$;
