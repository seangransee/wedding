-- Sample guests for an empty development database (cloud sessions seed this
-- automatically). Every name, slug, and contact detail here is made up.

INSERT INTO wedding_guests
  (name, slug, guest_count, sort_order, notes, phone_number, email_address, invite_sent, fuck_yes, fri_din)
VALUES
  ('Sean and Lexi', 'sean-and-lexi', 2, 1, 'Hidden from the admin audit table', '', '', true, true, true),
  ('Sample Solo Guest', 'sample-solo-guest', 1, 2, '', '555-0101', 'solo@example.com', true, false, false),
  ('Sample Couple', 'sample-couple', 2, 3, 'Has RSVPed yes', '555-0102', 'couple@example.com', true, false, true),
  ('Sample Family', 'sample-family', 4, 4, 'Still deciding', '', 'family@example.com', true, false, false),
  ('Sample Regrets', 'sample-regrets', 2, 5, 'Declined', '', '', true, false, false),
  ('Sample Not Yet Invited', 'sample-not-yet-invited', 2, 6, 'Slug is still editable', '', '', false, false, false);

INSERT INTO wedding_rsvps (guest_id, status, attending_count)
SELECT id, 'yes', 2 FROM wedding_guests WHERE slug IN ('sean-and-lexi', 'sample-couple');

INSERT INTO wedding_rsvps (guest_id, status, attending_count)
SELECT id, 'deciding', NULL FROM wedding_guests WHERE slug = 'sample-family';

INSERT INTO wedding_rsvps (guest_id, status, attending_count)
SELECT id, 'no', NULL FROM wedding_guests WHERE slug = 'sample-regrets';

INSERT INTO wedding_rsvp_attendees (rsvp_id, position, full_name, meal_type, dietary_notes)
SELECT rsvp.id, attendee.position, attendee.full_name, attendee.meal_type, attendee.dietary_notes
FROM wedding_rsvps rsvp
JOIN wedding_guests guest ON guest.id = rsvp.guest_id
JOIN (
  VALUES
    ('sean-and-lexi', 1, 'Sean', 'beef', NULL),
    ('sean-and-lexi', 2, 'Lexi', 'fish', NULL),
    ('sample-couple', 1, 'Alex Sample', 'vegetarian', 'No mushrooms'),
    ('sample-couple', 2, 'Jordan Sample', 'beef', NULL)
) AS attendee (slug, position, full_name, meal_type, dietary_notes)
  ON attendee.slug = guest.slug;

-- Mirror the audit history a real RSVP save writes (src/lib/db.ts). Migration
-- 002 would otherwise backfill audit rows without guest_name_current on rerun.
WITH audit_events AS (
  INSERT INTO wedding_rsvp_audit_events
    (event_type, guest_id, guest_name, guest_slug, guest_name_current, status, attending_count)
  SELECT 'rsvp', guest.id, guest.name, guest.slug, guest.name, rsvp.status, rsvp.attending_count
  FROM wedding_rsvps rsvp
  JOIN wedding_guests guest ON guest.id = rsvp.guest_id
  RETURNING id, guest_id
)
INSERT INTO wedding_rsvp_audit_attendees (audit_event_id, position, full_name, meal_type, dietary_notes)
SELECT audit_events.id, attendee.position, attendee.full_name, attendee.meal_type, attendee.dietary_notes
FROM audit_events
JOIN wedding_rsvps rsvp ON rsvp.guest_id = audit_events.guest_id
JOIN wedding_rsvp_attendees attendee ON attendee.rsvp_id = rsvp.id;
