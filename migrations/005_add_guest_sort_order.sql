ALTER TABLE wedding_guests
ADD COLUMN IF NOT EXISTS sort_order INTEGER;

WITH ordered_guests AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at DESC, id DESC)::integer AS next_sort_order
  FROM wedding_guests
)
UPDATE wedding_guests guest
SET sort_order = ordered_guests.next_sort_order
FROM ordered_guests
WHERE guest.id = ordered_guests.id
  AND guest.sort_order IS NULL;

ALTER TABLE wedding_guests
ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS wedding_guests_sort_order_idx
  ON wedding_guests (sort_order ASC, id ASC);
