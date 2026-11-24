export type ConfirmedAttendee = {
  name: string;
  meal: "beef" | "fish" | "vegetarian" | "";
  allergies: string;
  tableNumber: string;
  tableName: string;
  invitedFriday: boolean;
};

export const ATTENDEE_EXPORT_HEADERS = [
  "Name", "Meal", "Allergies", "Table number", "Table name", "Invited Friday?",
];

export function formatExportAllergies(value: string) {
  return value.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean)
    .map((line) => /[.!?;:,]["'”’\)\]]*$/.test(line) ? line : `${line}.`)
    .join(" ");
}

function integerTableNumber(value: string) {
  if (!/^[+-]?\d+$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

export function prepareAttendeeExportRows(rows: readonly ConfirmedAttendee[]) {
  const compareName = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });
  return rows.map((row) => ({ ...row, allergies: formatExportAllergies(row.allergies) }))
    .sort((a, b) => {
      const aNumber = integerTableNumber(a.tableNumber);
      const bNumber = integerTableNumber(b.tableNumber);
      // Numbered tables come first; blank or non-integer labels remain usable.
      if (aNumber !== null && bNumber !== null) {
        if (aNumber !== bNumber) return aNumber - bNumber;
      } else if (aNumber !== null) return -1;
      else if (bNumber !== null) return 1;
      else {
        if (!a.tableNumber && b.tableNumber) return 1;
        if (a.tableNumber && !b.tableNumber) return -1;
        const tableOrder = a.tableNumber.localeCompare(b.tableNumber, "en", { numeric: true });
        if (tableOrder) return tableOrder;
      }
      const firstName = (name: string) => name.trim().split(/\s+/)[0];
      return compareName(firstName(a.name), firstName(b.name)) || compareName(a.name, b.name);
    });
}

// One row per confirmed slot, including people whose details aren't filled in.
// Read the original strings directly: other admin/seating readers trim notes.
export const CONFIRMED_ATTENDEES_SQL = `
  SELECT COALESCE(a.full_name, '') AS name,
    COALESCE(a.meal_type, '') AS meal,
    COALESCE(a.dietary_notes, '') AS allergies,
    COALESCE(labels.number, '') AS "tableNumber",
    COALESCE(labels.name, '') AS "tableName",
    g.fri_din AS "invitedFriday"
  FROM wedding_guests g
  JOIN wedding_rsvps r ON r.guest_id = g.id AND r.status = 'yes'
  CROSS JOIN LATERAL generate_series(1, r.attending_count) AS slot(position)
  LEFT JOIN wedding_rsvp_attendees a ON a.rsvp_id = r.id AND a.position = slot.position
  LEFT JOIN wedding_seating_splits split ON split.guest_id = g.id
  LEFT JOIN wedding_seating_assignments party ON party.guest_id = g.id
  LEFT JOIN wedding_seating_person_assignments person
    ON person.guest_id = g.id AND person.person_position = slot.position
  LEFT JOIN wedding_seating_tables t ON t.id = (
    CASE WHEN split.guest_id IS NOT NULL THEN person.table_id ELSE party.table_id END
  ) AND t.kind <> 'bucket'
  LEFT JOIN LATERAL (
    SELECT string_agg(value, ' / ' ORDER BY created_at, id)
        FILTER (WHERE kind = 'number') AS number,
      string_agg(value, ' / ' ORDER BY created_at, id)
        FILTER (WHERE kind = 'name') AS name
    FROM wedding_seating_labels WHERE table_id = t.id
  ) labels ON true
  ORDER BY lower(COALESCE(a.full_name, '')), g.id, slot.position
`;

export function attendeeExportValues(row: ConfirmedAttendee) {
  return [row.name, row.meal, row.allergies, row.tableNumber, row.tableName,
    row.invitedFriday ? "true" : ""];
}

export function makeAttendeeCsv(rows: readonly ConfirmedAttendee[]) {
  // Quote every cell and preserve its value exactly, including newlines, leading
  // whitespace and formula-like text. Allergy formatting happens before this.
  const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return "\uFEFF" + [ATTENDEE_EXPORT_HEADERS, ...rows.map(attendeeExportValues)]
    .map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
