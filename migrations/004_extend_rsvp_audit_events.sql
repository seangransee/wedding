ALTER TABLE wedding_rsvp_audit_events
ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'rsvp';

ALTER TABLE wedding_rsvp_audit_events
ADD COLUMN IF NOT EXISTS guest_name_previous TEXT;

ALTER TABLE wedding_rsvp_audit_events
ADD COLUMN IF NOT EXISTS guest_name_current TEXT;

ALTER TABLE wedding_rsvp_audit_events
ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ;

UPDATE wedding_rsvp_audit_events
SET
  event_type = COALESCE(event_type, 'rsvp'),
  guest_name_current = COALESCE(guest_name_current, guest_name)
WHERE event_type IS NULL OR guest_name_current IS NULL;

ALTER TABLE wedding_rsvp_audit_events
ALTER COLUMN status DROP NOT NULL;

ALTER TABLE wedding_rsvp_audit_events
DROP CONSTRAINT IF EXISTS wedding_rsvp_audit_events_status_check;

ALTER TABLE wedding_rsvp_audit_events
DROP CONSTRAINT IF EXISTS wedding_rsvp_audit_events_check;

ALTER TABLE wedding_rsvp_audit_events
DROP CONSTRAINT IF EXISTS wedding_rsvp_audit_events_event_type_check;

ALTER TABLE wedding_rsvp_audit_events
DROP CONSTRAINT IF EXISTS wedding_rsvp_audit_events_guest_name_current_check;

ALTER TABLE wedding_rsvp_audit_events
ADD CONSTRAINT wedding_rsvp_audit_events_event_type_check
CHECK (event_type IN ('rsvp', 'guest_name'));

ALTER TABLE wedding_rsvp_audit_events
ADD CONSTRAINT wedding_rsvp_audit_events_guest_name_current_check
CHECK (guest_name_current IS NOT NULL AND length(btrim(guest_name_current)) > 0);

ALTER TABLE wedding_rsvp_audit_events
ADD CONSTRAINT wedding_rsvp_audit_events_check
CHECK (
  (
    event_type = 'rsvp'
    AND status IN ('yes', 'no', 'deciding')
    AND (
      (status = 'yes' AND attending_count IS NOT NULL)
      OR (status IN ('no', 'deciding') AND attending_count IS NULL)
    )
  )
  OR (
    event_type = 'guest_name'
    AND status IS NULL
    AND attending_count IS NULL
    AND guest_name_previous IS NOT NULL
    AND length(btrim(guest_name_previous)) > 0
  )
);

CREATE INDEX IF NOT EXISTS wedding_rsvp_audit_events_visible_idx
  ON wedding_rsvp_audit_events (soft_deleted_at, created_at DESC, id DESC);
