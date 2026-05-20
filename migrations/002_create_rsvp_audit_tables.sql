CREATE TABLE IF NOT EXISTS wedding_rsvp_audit_events (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guest_id INTEGER REFERENCES wedding_guests(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL CHECK (length(btrim(guest_name)) > 0),
  guest_slug TEXT NOT NULL CHECK (guest_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status TEXT NOT NULL CHECK (status IN ('yes', 'no', 'deciding')),
  attending_count INTEGER CHECK (attending_count BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status = 'yes' AND attending_count IS NOT NULL)
    OR (status IN ('no', 'deciding') AND attending_count IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS wedding_rsvp_audit_attendees (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  audit_event_id INTEGER NOT NULL REFERENCES wedding_rsvp_audit_events(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 10),
  full_name TEXT NOT NULL CHECK (length(btrim(full_name)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (audit_event_id, position)
);

CREATE INDEX IF NOT EXISTS wedding_rsvp_audit_events_created_at_idx
  ON wedding_rsvp_audit_events (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS wedding_rsvp_audit_events_guest_id_idx
  ON wedding_rsvp_audit_events (guest_id);

CREATE INDEX IF NOT EXISTS wedding_rsvp_audit_attendees_event_id_idx
  ON wedding_rsvp_audit_attendees (audit_event_id);

WITH backfilled_events AS (
  INSERT INTO wedding_rsvp_audit_events (
    guest_id,
    guest_name,
    guest_slug,
    status,
    attending_count,
    created_at
  )
  SELECT r.guest_id, guest.name, guest.slug, r.status, r.attending_count, r.updated_at
  FROM wedding_rsvps r
  JOIN wedding_guests guest ON guest.id = r.guest_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM wedding_rsvp_audit_events audit
    WHERE audit.guest_id = r.guest_id
  )
  RETURNING id, guest_id
)
INSERT INTO wedding_rsvp_audit_attendees (audit_event_id, position, full_name)
SELECT backfilled_events.id, attendee.position, attendee.full_name
FROM backfilled_events
JOIN wedding_rsvps r ON r.guest_id = backfilled_events.guest_id
JOIN wedding_rsvp_attendees attendee ON attendee.rsvp_id = r.id;
