-- RSVP autosaves used to write a history event on every save, even when
-- nothing had changed since the guest's previous event. This collapses each
-- run of back-to-back identical events for one invitation into its first
-- event, which records when that state was first saved. An event counts as
-- identical when every audit event column except id and created_at matches,
-- and its attendee rows match except for their ids and timestamps. A state
-- that comes back after a different one (yes -> no -> yes) is real history
-- and is kept.
--
-- Nothing is thrown away: every removed event is copied, with its attendee
-- rows, into wedding_rsvp_audit_duplicates first, along with the id of the
-- event it duplicated. The copy and the delete happen in one statement.
--
-- saveRsvp in src/lib/db.ts skips writing these duplicates now. The statement
-- below reruns on every deploy and finds nothing once history is clean.

CREATE TABLE IF NOT EXISTS wedding_rsvp_audit_duplicates (
  audit_event_id INTEGER PRIMARY KEY,
  kept_audit_event_id INTEGER NOT NULL,
  guest_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL,
  event JSONB NOT NULL,
  attendees JSONB NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wedding_rsvp_audit_duplicates_kept_idx
  ON wedding_rsvp_audit_duplicates (kept_audit_event_id);

WITH events AS (
  SELECT
    audit.id,
    audit.guest_id,
    audit.soft_deleted_at,
    audit.created_at,
    to_jsonb(audit) AS event,
    attendees.rows AS attendees,
    jsonb_build_array(to_jsonb(audit) - 'id' - 'created_at', attendees.content) AS content
  FROM wedding_rsvp_audit_events audit
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(jsonb_agg(to_jsonb(attendee) ORDER BY attendee.position), '[]'::jsonb) AS rows,
      COALESCE(
        jsonb_agg(
          to_jsonb(attendee) - 'id' - 'audit_event_id' - 'created_at'
          ORDER BY attendee.position
        ),
        '[]'::jsonb
      ) AS content
    FROM wedding_rsvp_audit_attendees attendee
    WHERE attendee.audit_event_id = audit.id
  ) attendees
),
-- One history per invitation. A deleted guest's events lose guest_id but all
-- share the soft_deleted_at stamp from that delete, which keeps them apart
-- from other deleted guests.
marked AS (
  SELECT
    events.*,
    content IS DISTINCT FROM lag(content) OVER history AS starts_run
  FROM events
  WINDOW history AS (PARTITION BY guest_id, soft_deleted_at ORDER BY created_at, id)
),
runs AS (
  SELECT
    marked.*,
    count(*) FILTER (WHERE starts_run) OVER history AS run_number
  FROM marked
  WINDOW history AS (PARTITION BY guest_id, soft_deleted_at ORDER BY created_at, id)
),
duplicates AS (
  SELECT
    runs.*,
    first_value(id) OVER (
      PARTITION BY guest_id, soft_deleted_at, run_number
      ORDER BY created_at, id
    ) AS kept_audit_event_id
  FROM runs
),
archived AS (
  INSERT INTO wedding_rsvp_audit_duplicates (
    audit_event_id,
    kept_audit_event_id,
    guest_id,
    created_at,
    event,
    attendees
  )
  SELECT id, kept_audit_event_id, guest_id, created_at, event, attendees
  FROM duplicates
  WHERE NOT starts_run
    AND id <> kept_audit_event_id
  ON CONFLICT (audit_event_id) DO NOTHING
  RETURNING audit_event_id
)
DELETE FROM wedding_rsvp_audit_events audit
USING archived
WHERE audit.id = archived.audit_event_id;
