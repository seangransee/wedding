ALTER TABLE wedding_guests
ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

ALTER TABLE wedding_guests
DROP COLUMN IF EXISTS guest_facing_name;
