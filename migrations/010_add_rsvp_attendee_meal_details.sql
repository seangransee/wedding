ALTER TABLE wedding_rsvp_attendees
ADD COLUMN IF NOT EXISTS meal_type TEXT;

ALTER TABLE wedding_rsvp_attendees
ADD COLUMN IF NOT EXISTS dietary_notes TEXT;

ALTER TABLE wedding_rsvp_audit_attendees
ADD COLUMN IF NOT EXISTS meal_type TEXT;

ALTER TABLE wedding_rsvp_audit_attendees
ADD COLUMN IF NOT EXISTS dietary_notes TEXT;

ALTER TABLE wedding_rsvp_attendees
ALTER COLUMN full_name DROP NOT NULL;

ALTER TABLE wedding_rsvp_audit_attendees
ALTER COLUMN full_name DROP NOT NULL;

ALTER TABLE wedding_rsvp_attendees
DROP CONSTRAINT IF EXISTS wedding_rsvp_attendees_full_name_check;

ALTER TABLE wedding_rsvp_audit_attendees
DROP CONSTRAINT IF EXISTS wedding_rsvp_audit_attendees_full_name_check;

ALTER TABLE wedding_rsvp_attendees
DROP CONSTRAINT IF EXISTS wedding_rsvp_attendees_meal_type_check;

ALTER TABLE wedding_rsvp_audit_attendees
DROP CONSTRAINT IF EXISTS wedding_rsvp_audit_attendees_meal_type_check;

ALTER TABLE wedding_rsvp_attendees
DROP CONSTRAINT IF EXISTS wedding_rsvp_attendees_detail_present_check;

ALTER TABLE wedding_rsvp_audit_attendees
DROP CONSTRAINT IF EXISTS wedding_rsvp_audit_attendees_detail_present_check;

ALTER TABLE wedding_rsvp_attendees
ADD CONSTRAINT wedding_rsvp_attendees_meal_type_check
CHECK (meal_type IS NULL OR meal_type IN ('beef', 'fish', 'vegetarian'));

ALTER TABLE wedding_rsvp_audit_attendees
ADD CONSTRAINT wedding_rsvp_audit_attendees_meal_type_check
CHECK (meal_type IS NULL OR meal_type IN ('beef', 'fish', 'vegetarian'));

ALTER TABLE wedding_rsvp_attendees
ADD CONSTRAINT wedding_rsvp_attendees_detail_present_check
CHECK (
  length(btrim(COALESCE(full_name, ''))) > 0
  OR meal_type IS NOT NULL
  OR length(btrim(COALESCE(dietary_notes, ''))) > 0
);

ALTER TABLE wedding_rsvp_audit_attendees
ADD CONSTRAINT wedding_rsvp_audit_attendees_detail_present_check
CHECK (
  length(btrim(COALESCE(full_name, ''))) > 0
  OR meal_type IS NOT NULL
  OR length(btrim(COALESCE(dietary_notes, ''))) > 0
);
