// Shared seating-chart model used by the database layer, server actions, and
// the /admin/seating client. Keep it free of server-only imports.
//
// Positions and sizes are "room units": 1 unit is 1 CSS pixel at 100% zoom.
// Table x/y are centers.

export const ROUND_TABLE_CAPACITY = 12;
export const SWEETHEART_TABLE_CAPACITY = 2;

export const ROUND_TABLE_DIAMETER = 220;
export const SWEETHEART_TABLE_WIDTH = 220;
export const SWEETHEART_TABLE_HEIGHT = 96;

export const ROOM_MIN_WIDTH = 480;
export const ROOM_MIN_HEIGHT = 360;
export const ROOM_MAX_SIZE = 6000;
export const DEFAULT_ROOM: SeatingRoom = { width: 1400, height: 1000 };

/** Keep tables at least this far from the room's right/bottom walls. */
export const ROOM_WALL_MARGIN = 24;

export const TABLE_NUMBER_MAX_LENGTH = 12;
export const TABLE_NAME_MAX_LENGTH = 40;

export type SeatingTableKind = "round" | "sweetheart";
/** RSVP state for seating: "none" means the guest has not responded yet. */
export type SeatingPartyStatus = "yes" | "deciding" | "none" | "no";

export type SeatingRoom = {
  width: number;
  height: number;
};

export type SeatingTable = {
  id: string;
  kind: SeatingTableKind;
  /** Free-form table number typed by the couple (numbers aren't sequential); may be blank. */
  number: string;
  /** Free-form optional name, e.g. "College friends". */
  name: string;
  capacity: number;
  x: number;
  y: number;
  /** Epoch milliseconds; tables list in creation order after the sweetheart table. */
  createdAt: number;
};

export type SeatingMealType = "beef" | "fish" | "vegetarian";

/** RSVP place-card details for one person; index = attendee position - 1. */
export type SeatingAttendee = {
  name: string;
  mealType: SeatingMealType | null;
  dietaryNotes: string;
};

/** One invitation (wedding_guests row). Parties are seated at a table as a unit. */
export type SeatingParty = {
  id: number;
  name: string;
  status: SeatingPartyStatus;
  /** The invitation's maximum headcount. */
  guestCount: number;
  /** Confirmed headcount when status is "yes". */
  attendingCount: number | null;
  /** Indexed by person position - 1; blank entries where no details were given. */
  attendees: SeatingAttendee[];
  sortOrder: number;
  tableId: string | null;
  /** Epoch milliseconds of the latest table assignment; orders parties within a table. */
  assignedAt: number | null;
};

/** Optional exact seat for one person (party + 1-based position) at the party's table. */
export type SeatingSeat = {
  tableId: string;
  seatNumber: number;
  partyId: number;
  position: number;
};

export type SeatingChartData = {
  room: SeatingRoom;
  tables: SeatingTable[];
  parties: SeatingParty[];
  seats: SeatingSeat[];
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * People a party takes at a table: the confirmed count for a yes, the full
 * invitation for maybes and non-responders (they might all come), and nobody
 * once they decline.
 */
export function partySeats(party: Pick<SeatingParty, "status" | "guestCount" | "attendingCount">) {
  if (party.status === "no") {
    return 0;
  }

  if (party.status === "yes") {
    return party.attendingCount ?? party.guestCount;
  }

  return party.guestCount;
}

export function isPartyUnconfirmed(party: Pick<SeatingParty, "status">) {
  return party.status === "deciding" || party.status === "none";
}

export function partyStatusLabel(status: SeatingPartyStatus) {
  if (status === "yes") {
    return "Confirmed";
  }
  if (status === "deciding") {
    return "Maybe";
  }
  if (status === "no") {
    return "Declined";
  }
  return "No reply";
}

export function tableSize(kind: SeatingTableKind) {
  return kind === "sweetheart"
    ? { width: SWEETHEART_TABLE_WIDTH, height: SWEETHEART_TABLE_HEIGHT }
    : { width: ROUND_TABLE_DIAMETER, height: ROUND_TABLE_DIAMETER };
}

export function tableCapacity(kind: SeatingTableKind) {
  return kind === "sweetheart" ? SWEETHEART_TABLE_CAPACITY : ROUND_TABLE_CAPACITY;
}

/** Keeps a table center inside the room so the whole table stays visible. */
export function clampTableCenter(
  kind: SeatingTableKind,
  x: number,
  y: number,
  room: SeatingRoom,
) {
  const { width, height } = tableSize(kind);

  return {
    x: Math.round(clamp(x, width / 2, Math.max(width / 2, room.width - width / 2))),
    y: Math.round(clamp(y, height / 2, Math.max(height / 2, room.height - height / 2))),
  };
}

/** Smallest room that still contains every table, so resizing never hides one. */
export function minimumRoomSize(tables: readonly Pick<SeatingTable, "kind" | "x" | "y">[]) {
  let width = ROOM_MIN_WIDTH;
  let height = ROOM_MIN_HEIGHT;

  for (const table of tables) {
    const size = tableSize(table.kind);
    width = Math.max(width, Math.ceil(table.x + size.width / 2 + ROOM_WALL_MARGIN));
    height = Math.max(height, Math.ceil(table.y + size.height / 2 + ROOM_WALL_MARGIN));
  }

  return { width: Math.min(width, ROOM_MAX_SIZE), height: Math.min(height, ROOM_MAX_SIZE) };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function createSeatingId() {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  // crypto.randomUUID only exists in secure contexts (e.g. not on a LAN IP).
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeLabel(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function normalizeTableNumber(value: string) {
  return normalizeLabel(value, TABLE_NUMBER_MAX_LENGTH);
}

export function normalizeTableName(value: string) {
  return normalizeLabel(value, TABLE_NAME_MAX_LENGTH);
}

/** "Table 7", the table's name, or a placeholder when neither is set. */
export function tableTitle(table: Pick<SeatingTable, "kind" | "number" | "name">) {
  if (table.number) {
    return `Table ${table.number}`;
  }

  if (table.name) {
    return table.name;
  }

  return table.kind === "sweetheart" ? "Sweetheart table" : "New table";
}

/** "Table 7 · College friends", falling back to whichever label exists. */
export function tableFullTitle(table: Pick<SeatingTable, "kind" | "number" | "name">) {
  return table.number && table.name ? `Table ${table.number} · ${table.name}` : tableTitle(table);
}

/**
 * Sweetheart table first, then numbered tables in natural order ("2" before
 * "10"), then unnumbered tables in the order they were added.
 */
export function compareSeatingTables(a: SeatingTable, b: SeatingTable) {
  if (a.kind !== b.kind) {
    return a.kind === "sweetheart" ? -1 : 1;
  }

  if (Boolean(a.number) !== Boolean(b.number)) {
    return a.number ? -1 : 1;
  }

  return (
    a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" }) ||
    a.createdAt - b.createdAt ||
    a.id.localeCompare(b.id)
  );
}

/** Place-card name for one person in a party, or a numbered stand-in. */
export function personLabel(party: Pick<SeatingParty, "name" | "attendees" | "status" | "guestCount" | "attendingCount">, position: number) {
  const name = party.attendees[position - 1]?.name.trim();

  if (name) {
    return name;
  }

  return partySeats(party) <= 1 ? party.name : `${party.name} (${position})`;
}

const NAME_FILLER_WORDS = new Set(["the", "and", "&", "+", "family", "kids", "guest", "guests", "plus", "one", "jr", "jr.", "sr", "sr."]);

/** Best-effort surname from an invitation name, e.g. "Jordan and Peyton Holloway + kids" -> "Holloway". */
function partySurname(partyName: string) {
  const words = partyName
    .split(/\s+/)
    .map((word) => word.replace(/[(),]/g, ""))
    .filter((word) => word && !NAME_FILLER_WORDS.has(word.toLowerCase()));

  return words.at(-1) ?? partyName;
}

/** Compact seat label: "Alex S." for named guests, "Holloway 2" for unnamed party members. */
export function shortPersonLabel(
  party: Pick<SeatingParty, "name" | "attendees" | "status" | "guestCount" | "attendingCount">,
  position: number,
) {
  const name = party.attendees[position - 1]?.name.trim();

  if (name) {
    const words = name.split(/\s+/);
    return words.length > 1 ? `${words[0]} ${words.at(-1)!.charAt(0)}.` : name;
  }

  return partySeats(party) <= 1 ? party.name : `${partySurname(party.name)} ${position}`;
}

export function personKey(partyId: number, position: number) {
  return `${partyId}:${position}`;
}

/**
 * Seats that still apply: the party is still at that table, the person is
 * still part of the party's headcount, and the seat exists at the table.
 */
export function currentSeats(
  seats: readonly SeatingSeat[],
  parties: readonly SeatingParty[],
  tables: readonly SeatingTable[],
) {
  const partiesById = new Map(parties.map((party) => [party.id, party]));
  const tablesById = new Map(tables.map((table) => [table.id, table]));

  return seats.filter((seat) => {
    const party = partiesById.get(seat.partyId);
    const table = tablesById.get(seat.tableId);

    return Boolean(
      party &&
        table &&
        party.tableId === seat.tableId &&
        seat.position >= 1 &&
        seat.position <= partySeats(party) &&
        seat.seatNumber >= 1 &&
        seat.seatNumber <= table.capacity,
    );
  });
}

type Rect = { left: number; top: number; right: number; bottom: number };

function tableRect(table: Pick<SeatingTable, "kind" | "x" | "y">): Rect {
  const { width, height } = tableSize(table.kind);

  return {
    left: table.x - width / 2,
    top: table.y - height / 2,
    right: table.x + width / 2,
    bottom: table.y + height / 2,
  };
}

function rectsOverlap(a: Rect, b: Rect, gap: number) {
  return (
    a.left < b.right + gap &&
    b.left < a.right + gap &&
    a.top < b.bottom + gap &&
    b.top < a.bottom + gap
  );
}

const NEW_TABLE_MARGIN = 36;
const NEW_TABLE_GAP = 48;

/**
 * Where a new round table should go: the first grid slot (left to right, top to
 * bottom) that doesn't overlap an existing table. When the room is full the
 * table goes in a new row below everything and the room grows to fit it.
 */
export function findOpenTableSpot(
  room: SeatingRoom,
  tables: readonly Pick<SeatingTable, "kind" | "x" | "y">[],
) {
  const radius = ROUND_TABLE_DIAMETER / 2;
  const step = ROUND_TABLE_DIAMETER + NEW_TABLE_GAP;
  const occupied = tables.map(tableRect);
  const fits = (x: number, y: number) => {
    const candidate = tableRect({ kind: "round", x, y });
    return !occupied.some((rect) => rectsOverlap(candidate, rect, NEW_TABLE_GAP / 2));
  };

  for (let y = NEW_TABLE_MARGIN + radius; y + radius + ROOM_WALL_MARGIN <= room.height; y += step) {
    for (let x = NEW_TABLE_MARGIN + radius; x + radius + ROOM_WALL_MARGIN <= room.width; x += step) {
      if (fits(x, y)) {
        return { x, y, room };
      }
    }
  }

  const contentBottom = occupied.reduce((bottom, rect) => Math.max(bottom, rect.bottom), 0);
  const x = NEW_TABLE_MARGIN + radius;
  const y = Math.round(contentBottom + NEW_TABLE_GAP + radius);
  const height = clamp(Math.max(room.height, y + radius + NEW_TABLE_MARGIN), ROOM_MIN_HEIGHT, ROOM_MAX_SIZE);

  return { x, y: Math.min(y, height - radius - ROOM_WALL_MARGIN), room: { width: room.width, height } };
}

export type FullnessTone = "empty" | "filling" | "full" | "over";

export type FullnessStyle = {
  tone: FullnessTone;
  background: string;
  border: string;
  text: string;
  /** Short status such as "Empty", "3 open", "Full", or "2 over". */
  label: string;
};

// Fill colors for a partly filled table, indexed by how full it is on a
// 12-seat scale (1..11). Pale cream when nearly empty, warming through yellow
// and lime, with deliberately bigger jumps for 9, 10, and 11 so a table that is
// one or two short is easy to tell apart from a full one.
const FILLING_STEPS: ReadonlyArray<readonly [number, number, number]> = [
  [0.978, 0.02, 95],
  [0.972, 0.03, 96],
  [0.966, 0.04, 97],
  [0.958, 0.05, 98],
  [0.95, 0.062, 100],
  [0.94, 0.075, 103],
  [0.928, 0.09, 107],
  [0.912, 0.106, 113],
  [0.89, 0.125, 121],
  [0.855, 0.148, 131],
  [0.8, 0.165, 142],
];

function oklch(lightness: number, chroma: number, hue: number) {
  return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue})`;
}

/** Color-codes a table by headcount: empty, filling up, exactly full, or over capacity. */
export function fullnessStyle(count: number, capacity: number): FullnessStyle {
  if (count <= 0) {
    return {
      tone: "empty",
      background: "#fffdfd",
      border: "#d6a9bd",
      text: "#8f5070",
      label: "Empty",
    };
  }

  if (count > capacity) {
    return {
      tone: "over",
      background: oklch(0.57, 0.215, 27),
      border: oklch(0.42, 0.17, 27),
      text: "#ffffff",
      label: `${count - capacity} over`,
    };
  }

  if (count === capacity) {
    return {
      tone: "full",
      background: oklch(0.55, 0.14, 153),
      border: oklch(0.4, 0.11, 153),
      text: "#ffffff",
      label: "Full",
    };
  }

  const stepIndex = clamp(Math.round((count / capacity) * ROUND_TABLE_CAPACITY), 1, FILLING_STEPS.length) - 1;
  const [lightness, chroma, hue] = FILLING_STEPS[stepIndex];

  return {
    tone: "filling",
    background: oklch(lightness, chroma, hue),
    border: oklch(lightness - 0.24, Math.min(chroma + 0.05, 0.2), hue),
    text: "#3d1426",
    label: `${capacity - count} open`,
  };
}

/** Lowercase search tokens; a party matches when every token is in its name or attendee names. */
export function searchTokens(query: string) {
  const normalized = query.trim().toLowerCase();
  return normalized ? normalized.split(/\s+/) : [];
}

export function partyMatchesSearch(
  party: Pick<SeatingParty, "name" | "attendees">,
  tokens: readonly string[],
) {
  if (tokens.length === 0) {
    return true;
  }

  const haystack = [party.name, ...party.attendees.map((attendee) => attendee.name)].join(" ").toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function mealLabel(mealType: SeatingMealType | null) {
  if (mealType === "beef") {
    return "Beef";
  }
  if (mealType === "fish") {
    return "Fish";
  }
  if (mealType === "vegetarian") {
    return "Vegetarian";
  }
  return "";
}

/**
 * Quotes one CSV cell. Place-card names and dietary notes are typed by guests,
 * so text a spreadsheet would run as a formula gets a leading apostrophe.
 */
function csvCell(value: number | string | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * One row per person who might come: every table in display order (people with
 * an exact seat first, by seat), then everyone not seated yet. Declined
 * invitations are left out.
 */
export function makeSeatingCsv(data: SeatingChartData) {
  const rows: Array<Array<number | string>> = [[
    "Table number",
    "Table name",
    "Seat",
    "Guest",
    "Invitation",
    "RSVP",
    "Meal",
    "Dietary notes",
  ]];
  const seatsByPerson = new Map(
    currentSeats(data.seats, data.parties, data.tables).map((seat) => [
      personKey(seat.partyId, seat.position),
      seat.seatNumber,
    ]),
  );
  const coming = data.parties.filter((party) => partySeats(party) > 0);
  const tableIds = new Set(data.tables.map((table) => table.id));

  function personRows(party: SeatingParty) {
    return Array.from({ length: partySeats(party) }, (_, index) => {
      const position = index + 1;
      const attendee = party.attendees[index];

      return {
        seat: seatsByPerson.get(personKey(party.id, position)) ?? null,
        cells: [
          personLabel(party, position),
          party.name,
          partyStatusLabel(party.status),
          mealLabel(attendee?.mealType ?? null),
          attendee?.dietaryNotes.trim() ?? "",
        ],
      };
    });
  }

  for (const table of [...data.tables].sort(compareSeatingTables)) {
    const tableParties = coming
      .filter((party) => party.tableId === table.id)
      .sort((a, b) => (a.assignedAt ?? 0) - (b.assignedAt ?? 0) || a.sortOrder - b.sortOrder);
    const people = tableParties.flatMap(personRows);
    const seated = people.filter((person) => person.seat !== null).sort((a, b) => a.seat! - b.seat!);
    const unseated = people.filter((person) => person.seat === null);

    for (const person of [...seated, ...unseated]) {
      // Only unlabeled tables fall back to a generic name, so the name column stays the typed name.
      rows.push([table.number, table.name || (table.number ? "" : tableTitle(table)), person.seat ?? "", ...person.cells]);
    }
  }

  for (const party of coming) {
    if (party.tableId && tableIds.has(party.tableId)) {
      continue;
    }

    for (const person of personRows(party)) {
      rows.push(["", "Not seated", "", ...person.cells]);
    }
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
