ALTER TABLE wedding_photos
  ADD COLUMN IF NOT EXISTS country_code text
    CHECK (country_code IS NULL OR country_code = '' OR country_code ~ '^[A-Z]{2}$'),
  ADD COLUMN IF NOT EXISTS location_text text
    CHECK (location_text IS NULL OR char_length(location_text) <= 160);
