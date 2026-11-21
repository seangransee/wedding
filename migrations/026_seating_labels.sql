-- Independent name/number inventory. A label is in the list, on a table, or
-- at a free floor position. Multiple labels per table are deliberately allowed.
CREATE TABLE IF NOT EXISTS wedding_seating_labels (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('name', 'number')),
  value TEXT NOT NULL CHECK (length(btrim(value)) > 0 AND length(value) <= CASE WHEN kind = 'number' THEN 12 ELSE 40 END),
  table_id UUID REFERENCES wedding_seating_tables(id) ON DELETE SET NULL,
  x INTEGER CHECK (x BETWEEN -3000 AND 9000),
  y INTEGER CHECK (y BETWEEN -3000 AND 9000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((x IS NULL) = (y IS NULL)),
  CHECK (table_id IS NULL OR x IS NULL)
);

CREATE INDEX IF NOT EXISTS wedding_seating_labels_table_idx ON wedding_seating_labels(table_id);

-- Move existing labels exactly once, in the same statement that clears the
-- legacy fields. Re-running the migration never resurrects a moved label.
WITH migrated AS (
  INSERT INTO wedding_seating_labels (id, kind, value, table_id)
  SELECT gen_random_uuid(), label.kind, btrim(label.value), seating_table.id
  FROM wedding_seating_tables seating_table
  CROSS JOIN LATERAL (VALUES ('number', seating_table.number), ('name', seating_table.name)) label(kind, value)
  WHERE seating_table.kind <> 'bucket' AND btrim(label.value) <> ''
  RETURNING table_id
)
UPDATE wedding_seating_tables SET number = '', name = ''
WHERE id IN (SELECT table_id FROM migrated);
