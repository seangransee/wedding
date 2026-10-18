ALTER TABLE wedding_rsvps
ADD COLUMN IF NOT EXISTS mailing_address_line1 TEXT NOT NULL DEFAULT '';

ALTER TABLE wedding_rsvps
ADD COLUMN IF NOT EXISTS mailing_address_line2 TEXT NOT NULL DEFAULT '';

ALTER TABLE wedding_rsvps
ADD COLUMN IF NOT EXISTS mailing_address_city TEXT NOT NULL DEFAULT '';

ALTER TABLE wedding_rsvps
ADD COLUMN IF NOT EXISTS mailing_address_region TEXT NOT NULL DEFAULT '';

ALTER TABLE wedding_rsvps
ADD COLUMN IF NOT EXISTS mailing_address_postal_code TEXT NOT NULL DEFAULT '';

ALTER TABLE wedding_rsvps
ADD COLUMN IF NOT EXISTS mailing_address_country TEXT NOT NULL DEFAULT '';

ALTER TABLE wedding_rsvp_audit_events
ADD COLUMN IF NOT EXISTS mailing_address_line1 TEXT NOT NULL DEFAULT '';

ALTER TABLE wedding_rsvp_audit_events
ADD COLUMN IF NOT EXISTS mailing_address_line2 TEXT NOT NULL DEFAULT '';

ALTER TABLE wedding_rsvp_audit_events
ADD COLUMN IF NOT EXISTS mailing_address_city TEXT NOT NULL DEFAULT '';

ALTER TABLE wedding_rsvp_audit_events
ADD COLUMN IF NOT EXISTS mailing_address_region TEXT NOT NULL DEFAULT '';

ALTER TABLE wedding_rsvp_audit_events
ADD COLUMN IF NOT EXISTS mailing_address_postal_code TEXT NOT NULL DEFAULT '';

ALTER TABLE wedding_rsvp_audit_events
ADD COLUMN IF NOT EXISTS mailing_address_country TEXT NOT NULL DEFAULT '';
