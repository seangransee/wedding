// Shared seating-chart model used by the database layer, server actions, and
// the /admin/seating client. Keep it free of server-only imports.
//
// Positions and sizes are "room units": 1 unit is 1 CSS pixel at 100% zoom.
// Table x/y are centers.

/** Seats at each round table until the couple picks another number in the floor plan. */
export const DEFAULT_TABLE_CAPACITY = 12;
/** The range the floor plan's "Seats per table" setting (round tables only) allows. */
export const TABLE_CAPACITY_MIN = 2;
export const TABLE_CAPACITY_MAX = 20;
export const SWEETHEART_TABLE_CAPACITY = 2;

/** Rectangular tables each keep their own seat count, set in the table's dialog. */
export const RECT_TABLE_DEFAULT_CAPACITY = 8;
export const RECT_TABLE_CAPACITY_MIN = 1;
export const RECT_TABLE_CAPACITY_MAX = 30;

export const ROUND_TABLE_DIAMETER = 220;
export const SWEETHEART_TABLE_WIDTH = 220;
export const SWEETHEART_TABLE_HEIGHT = 96;
/** A new rectangular table's size, and the smallest either side can be dragged to. */
export const RECT_TABLE_DEFAULT_WIDTH = 320;
export const RECT_TABLE_DEFAULT_HEIGHT = 110;
export const RECT_TABLE_MIN_SIZE = 60;

export const ROOM_MIN_WIDTH = 480;
export const ROOM_MIN_HEIGHT = 360;
export const ROOM_MAX_SIZE = 6000;
export const DEFAULT_ROOM: SeatingRoom = { width: 1400, height: 1000 };

/** Keep tables at least this far from the room's right/bottom walls. */
export const ROOM_WALL_MARGIN = 24;

/** Buckets are a fixed width and grow downward to fit everyone in them. */
export const BUCKET_WIDTH = 260;
/** Buckets can sit outside the room, within this range of room units. */
export const BUCKET_COORD_MIN = -3000;
export const BUCKET_COORD_MAX = ROOM_MAX_SIZE + 3000;

/** Floor areas (stage, dance floor): a new one's size, and the smallest one can be. */
export const AREA_DEFAULT_WIDTH = 420;
export const AREA_DEFAULT_HEIGHT = 280;
export const AREA_MIN_SIZE = 40;
export const AREA_NAME_MAX_LENGTH = 40;

export const TABLE_NUMBER_MAX_LENGTH = 12;
export const TABLE_NAME_MAX_LENGTH = 40;

/**
 * "round" tables all seat the floor plan's "Seats per table"; "rect" tables are
 * resizable rectangles with their own seat count; "sweetheart" seats the couple.
 */
export type SeatingTableKind = "round" | "sweetheart" | "rect";
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
  /** Size in room units: stored for rectangular tables, fixed by kind for the others. */
  width: number;
  height: number;
  /** Epoch milliseconds; tables list in creation order after the sweetheart table. */
  createdAt: number;
};

/**
 * A named holding area for people who aren't seated yet, e.g. "Dad's family".
 * Parties and split people are put in a bucket through their tableId, but
 * bucket members still count as not seated. x/y is the top-left corner and
 * may be outside the room.
 */
export type SeatingBucket = {
  id: string;
  name: string;
  x: number;
  y: number;
  /**
   * A bubble is a little unnamed bucket made by dropping someone on empty
   * floor. It shows just its people, isn't listed as its own sidebar section
   * (its people count as plain Not seated), and is deleted once empty.
   */
  bubble: boolean;
  /** Epoch milliseconds; buckets list in creation order. */
  createdAt: number;
};

/**
 * A named rectangle on the floor for something that isn't a table, like the
 * stage or the dance floor. x/y is the top-left corner; areas stay inside the
 * room. Nobody sits in an area.
 */
export type SeatingArea = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Epoch milliseconds; later areas draw on top. */
  createdAt: number;
};

export type SeatingMealType = "beef" | "fish" | "vegetarian";

/** RSVP place-card details for one person; index = attendee position - 1. */
export type SeatingAttendee = {
  name: string;
  mealType: SeatingMealType | null;
  dietaryNotes: string;
};

/** Where one person from a split party sits. */
export type SeatingPersonAssignment = {
  position: number;
  tableId: string;
  /** Epoch milliseconds. */
  assignedAt: number;
};

/**
 * One invitation (wedding_guests row). Parties sit at a table together unless
 * split, in which case each person has their own table (see people).
 */
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
  /** The whole party's table; always null while split. */
  tableId: string | null;
  /** Epoch milliseconds of the latest table assignment; orders parties within a table. */
  assignedAt: number | null;
  /** True when the party's people are seated individually. */
  split: boolean;
  /** Split parties only: the table of each seated person (unseated people have no entry). */
  people: SeatingPersonAssignment[];
};

/**
 * What gets seated and dragged around: a whole party, or one person from a
 * split party. Shaped like a party so headcount and badge helpers work on both.
 */
export type SeatingUnit = {
  /** "12" for a whole party, "12:3" for person 3 of a split party. */
  id: string;
  partyId: number;
  /** The split-off person's 1-based position, or null for a whole party. */
  position: number | null;
  /** The invitation name, or a split person's place-card first name. */
  name: string;
  status: SeatingPartyStatus;
  /** For a split person: 1. */
  guestCount: number;
  attendingCount: number | null;
  attendees: SeatingAttendee[];
  sortOrder: number;
  tableId: string | null;
  assignedAt: number | null;
  party: SeatingParty;
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
  /** Seats at every round table (new ones too); the sweetheart table always seats 2. */
  tableCapacity: number;
  tables: SeatingTable[];
  buckets: SeatingBucket[];
  areas: SeatingArea[];
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

/** The fixed size of a round or sweetheart table (rectangular tables start at this size). */
export function defaultTableSize(kind: SeatingTableKind) {
  if (kind === "sweetheart") {
    return { width: SWEETHEART_TABLE_WIDTH, height: SWEETHEART_TABLE_HEIGHT };
  }
  if (kind === "rect") {
    return { width: RECT_TABLE_DEFAULT_WIDTH, height: RECT_TABLE_DEFAULT_HEIGHT };
  }
  return { width: ROUND_TABLE_DIAMETER, height: ROUND_TABLE_DIAMETER };
}

/** Anything with a table kind, plus its own size when it's a rectangular table. */
export type TableShape = Pick<SeatingTable, "kind"> & Partial<Pick<SeatingTable, "width" | "height">>;

export function tableSize(table: TableShape) {
  if (table.kind === "rect" && table.width && table.height) {
    return { width: table.width, height: table.height };
  }
  return defaultTableSize(table.kind);
}

export function isTableCapacity(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= TABLE_CAPACITY_MIN && (value as number) <= TABLE_CAPACITY_MAX;
}

export function isRectTableCapacity(value: unknown): value is number {
  return (
    Number.isInteger(value) && (value as number) >= RECT_TABLE_CAPACITY_MIN && (value as number) <= RECT_TABLE_CAPACITY_MAX
  );
}

export function isRectTableSide(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= RECT_TABLE_MIN_SIZE && (value as number) <= ROOM_MAX_SIZE;
}

/** Keeps a table center inside the room so the whole table stays visible. */
export function clampTableCenter(
  table: TableShape,
  x: number,
  y: number,
  room: SeatingRoom,
) {
  const { width, height } = tableSize(table);

  return {
    x: Math.round(clamp(x, width / 2, Math.max(width / 2, room.width - width / 2))),
    y: Math.round(clamp(y, height / 2, Math.max(height / 2, room.height - height / 2))),
  };
}

/** Smallest room that still contains every table and area, so resizing never hides one. */
export function minimumRoomSize(
  tables: readonly (TableShape & Pick<SeatingTable, "x" | "y">)[],
  areas: readonly Pick<SeatingArea, "x" | "y" | "width" | "height">[] = [],
) {
  let width = ROOM_MIN_WIDTH;
  let height = ROOM_MIN_HEIGHT;

  for (const table of tables) {
    const size = tableSize(table);
    width = Math.max(width, Math.ceil(table.x + size.width / 2 + ROOM_WALL_MARGIN));
    height = Math.max(height, Math.ceil(table.y + size.height / 2 + ROOM_WALL_MARGIN));
  }

  // Areas may sit flush against a wall (a stage often does).
  for (const area of areas) {
    width = Math.max(width, area.x + area.width);
    height = Math.max(height, area.y + area.height);
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

export function normalizeAreaName(value: string) {
  return normalizeLabel(value, AREA_NAME_MAX_LENGTH);
}

export function areaTitle(area: Pick<SeatingArea, "name">) {
  return area.name || "Unnamed area";
}

type AreaRect = Pick<SeatingArea, "x" | "y" | "width" | "height">;

/** Keeps an area at least AREA_MIN_SIZE and entirely inside the room. */
export function clampAreaRect(rect: AreaRect, room: SeatingRoom): AreaRect {
  const width = Math.round(clamp(rect.width, AREA_MIN_SIZE, Math.max(AREA_MIN_SIZE, room.width)));
  const height = Math.round(clamp(rect.height, AREA_MIN_SIZE, Math.max(AREA_MIN_SIZE, room.height)));

  return {
    x: Math.round(clamp(rect.x, 0, Math.max(0, room.width - width))),
    y: Math.round(clamp(rect.y, 0, Math.max(0, room.height - height))),
    width,
    height,
  };
}

/** Which edges a resize handle moves: n/s/e/w and the four corners. */
export type AreaResizeEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/**
 * Resizes an area by dragging one edge or corner by (dx, dy) room units. The
 * opposite edges stay put, and the area never shrinks below `minSize`
 * (AREA_MIN_SIZE by default) or leaves the room.
 */
export function resizeAreaRect(
  start: AreaRect,
  edge: AreaResizeEdge,
  dx: number,
  dy: number,
  room: SeatingRoom,
  minSize = AREA_MIN_SIZE,
): AreaRect {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (edge.includes("w")) {
    left = clamp(left + dx, 0, right - minSize);
  }
  if (edge.includes("e")) {
    right = clamp(right + dx, left + minSize, Math.max(left + minSize, room.width));
  }
  if (edge.includes("n")) {
    top = clamp(top + dy, 0, bottom - minSize);
  }
  if (edge.includes("s")) {
    bottom = clamp(bottom + dy, top + minSize, Math.max(top + minSize, room.height));
  }

  const x = Math.round(left);
  const y = Math.round(top);

  return { x, y, width: Math.round(right) - x, height: Math.round(bottom) - y };
}

/**
 * Where a new area goes: the open spot (not overlapping any table or area)
 * nearest the room's center, or the center itself when the floor is full.
 */
export function findOpenAreaSpot(
  room: SeatingRoom,
  areas: readonly AreaRect[],
  tables: readonly (TableShape & Pick<SeatingTable, "x" | "y">)[] = [],
) {
  const width = Math.min(AREA_DEFAULT_WIDTH, room.width);
  const height = Math.min(AREA_DEFAULT_HEIGHT, room.height);
  const centerX = Math.round((room.width - width) / 2);
  const centerY = Math.round((room.height - height) / 2);
  const occupied: Rect[] = [
    ...tables.map(tableRect),
    ...areas.map((area) => ({ left: area.x, top: area.y, right: area.x + area.width, bottom: area.y + area.height })),
  ];
  const step = 20;
  let best: { x: number; y: number; distance: number } | null = null;

  // Grid aligned to the centered spot so an empty room gets a centered area.
  for (let y = centerY % step; y + height <= room.height; y += step) {
    for (let x = centerX % step; x + width <= room.width; x += step) {
      const candidate = { left: x, top: y, right: x + width, bottom: y + height };
      const distance = (x - centerX) ** 2 + (y - centerY) ** 2;

      if ((!best || distance < best.distance) && !occupied.some((rect) => rectsOverlap(candidate, rect, 24))) {
        best = { x, y, distance };
      }
    }
  }

  return clampAreaRect({ x: best?.x ?? centerX, y: best?.y ?? centerY, width, height }, room);
}

export function bucketTitle(bucket: Pick<SeatingBucket, "name">) {
  return bucket.name || "Unnamed bucket";
}

/** Rough bucket height before it's measured: a header plus two names per row. */
export function estimatedBucketHeight(memberCount: number) {
  return 64 + Math.ceil(Math.max(1, memberCount) / 2) * 30;
}

/** Where a new bucket goes: just right of the room, below any buckets already there. */
export function findOpenBucketSpot(
  room: SeatingRoom,
  buckets: readonly Pick<SeatingBucket, "x" | "y">[],
  heightOf: (index: number) => number,
) {
  const x = Math.min(room.width + 48, BUCKET_COORD_MAX - BUCKET_WIDTH);
  let y = 0;

  buckets.forEach((bucket, index) => {
    if (bucket.x + BUCKET_WIDTH > x && bucket.x < x + BUCKET_WIDTH) {
      y = Math.max(y, bucket.y + heightOf(index) + 24);
    }
  });

  return { x: Math.round(x), y: Math.round(Math.min(y, BUCKET_COORD_MAX - 200)) };
}

export function clampBucketPosition(x: number, y: number) {
  return {
    x: Math.round(clamp(x, BUCKET_COORD_MIN, BUCKET_COORD_MAX - BUCKET_WIDTH)),
    y: Math.round(clamp(y, BUCKET_COORD_MIN, BUCKET_COORD_MAX - 100)),
  };
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
  if ((a.kind === "sweetheart") !== (b.kind === "sweetheart")) {
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

/** A party can be split when more than one person from it might come. */
export function canSplitParty(party: Pick<SeatingParty, "status" | "guestCount" | "attendingCount">) {
  return partySeats(party) > 1;
}

/**
 * Chip label for one person from a split party: their place-card first name,
 * or "Alex S." when someone else in the party shares it. Unnamed people fall
 * back to "Holloway 2".
 */
export function splitPersonName(
  party: Pick<SeatingParty, "name" | "attendees" | "status" | "guestCount" | "attendingCount">,
  position: number,
) {
  const name = party.attendees[position - 1]?.name.trim();

  if (!name) {
    return shortPersonLabel(party, position);
  }

  const firstName = name.split(/\s+/)[0];
  const sharesFirstName = party.attendees.some(
    (attendee, index) =>
      index !== position - 1 && attendee.name.trim().split(/\s+/)[0]?.toLowerCase() === firstName.toLowerCase(),
  );

  return sharesFirstName ? shortPersonLabel(party, position) : firstName;
}

/**
 * Floor-plan chip name rows. A whole party lists everyone's full place-card
 * names once any are filled in, with "+1" after the last for people still
 * unnamed; until then it keeps the invitation name. A split person shows their
 * own full place-card name, or falls back to "Holloway 2".
 */
export function planChipNames(
  unit: Pick<SeatingUnit, "name" | "position" | "attendees" | "status" | "guestCount" | "attendingCount">,
): string[] {
  if (unit.position !== null) {
    return [unit.attendees[0]?.name.trim() || unit.name];
  }

  const positions = unitPositions(unit);
  const names = positions.map((position) => unit.attendees[position - 1]?.name.trim() ?? "").filter(Boolean);
  if (names.length === 0) {
    return [unit.name];
  }

  const unnamed = positions.length - names.length;
  if (unnamed > 0) {
    names[names.length - 1] += ` +${unnamed}`;
  }

  return names;
}

/** Floor-plan chip names on one line: "Maria Rivera, Alex Rivera & Sam Rivera". */
export function planChipName(unit: Parameters<typeof planChipNames>[0]) {
  const names = planChipNames(unit);

  return names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names.at(-1)}` : names[0];
}

/** The table one person sits at, whether with their whole party or on their own. */
export function personTableId(party: Pick<SeatingParty, "split" | "people" | "tableId">, position: number) {
  if (!party.split) {
    return party.tableId;
  }

  return party.people.find((person) => person.position === position)?.tableId ?? null;
}

/**
 * Seating units for every party: whole parties as-is, and one unit per person
 * for split parties. A split person past the party's current headcount (they
 * dropped out, or the party declined) only appears while they still hold a
 * table, as a declined unit so they can be cleared off it.
 */
export function seatingUnits(parties: readonly SeatingParty[]): SeatingUnit[] {
  return parties.flatMap((party): SeatingUnit[] => {
    if (!party.split) {
      return [{
        id: String(party.id),
        partyId: party.id,
        position: null,
        name: party.name,
        status: party.status,
        guestCount: party.guestCount,
        attendingCount: party.attendingCount,
        attendees: party.attendees,
        sortOrder: party.sortOrder,
        tableId: party.tableId,
        assignedAt: party.assignedAt,
        party,
      }];
    }

    const headcount = partySeats(party);
    const positions = new Set(Array.from({ length: headcount }, (_, index) => index + 1));
    for (const person of party.people) {
      positions.add(person.position);
    }

    return [...positions].sort((a, b) => a - b).map((position) => {
      const assignment = party.people.find((person) => person.position === position);
      const status = position <= headcount ? party.status : "no";

      return {
        id: personKey(party.id, position),
        partyId: party.id,
        position,
        name: splitPersonName(party, position),
        status,
        guestCount: 1,
        attendingCount: status === "yes" ? 1 : null,
        attendees: [party.attendees[position - 1] ?? { name: "", mealType: null, dietaryNotes: "" }],
        sortOrder: party.sortOrder,
        tableId: assignment?.tableId ?? null,
        assignedAt: assignment?.assignedAt ?? null,
        party,
      };
    });
  });
}

/** The party positions a unit covers: everyone who might come, or the one split person. */
export function unitPositions(unit: Pick<SeatingUnit, "position" | "status" | "guestCount" | "attendingCount">) {
  if (unit.position !== null) {
    return partySeats(unit) > 0 ? [unit.position] : [];
  }

  return Array.from({ length: partySeats(unit) }, (_, index) => index + 1);
}

/** Within a table: in the order they were seated, then guest-list order, then by person. */
export function compareUnitsAtTable(a: SeatingUnit, b: SeatingUnit) {
  return (
    (a.assignedAt ?? 0) - (b.assignedAt ?? 0) ||
    a.sortOrder - b.sortOrder ||
    a.partyId - b.partyId ||
    (a.position ?? 0) - (b.position ?? 0)
  );
}

/**
 * Seats that still apply: the person is still at that table (with their party
 * or on their own), still part of the party's headcount, and the seat exists
 * at the table.
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
        personTableId(party, seat.position) === seat.tableId &&
        seat.position >= 1 &&
        seat.position <= partySeats(party) &&
        seat.seatNumber >= 1 &&
        seat.seatNumber <= table.capacity,
    );
  });
}

type Rect = { left: number; top: number; right: number; bottom: number };

function tableRect(table: TableShape & Pick<SeatingTable, "x" | "y">): Rect {
  const { width, height } = tableSize(table);

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
 * Where a new table should go (round unless `kind` says otherwise): the first
 * grid slot (left to right, top to bottom) that doesn't overlap an existing
 * table. When the room is full the table goes in a new row below everything
 * and the room grows to fit it.
 */
export function findOpenTableSpot(
  room: SeatingRoom,
  tables: readonly (TableShape & Pick<SeatingTable, "x" | "y">)[],
  kind: SeatingTableKind = "round",
) {
  const size = defaultTableSize(kind);
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  const occupied = tables.map(tableRect);
  const fits = (x: number, y: number) => {
    const candidate = tableRect({ kind, x, y });
    return !occupied.some((rect) => rectsOverlap(candidate, rect, NEW_TABLE_GAP / 2));
  };

  for (let y = NEW_TABLE_MARGIN + halfHeight; y + halfHeight + ROOM_WALL_MARGIN <= room.height; y += size.height + NEW_TABLE_GAP) {
    for (let x = NEW_TABLE_MARGIN + halfWidth; x + halfWidth + ROOM_WALL_MARGIN <= room.width; x += size.width + NEW_TABLE_GAP) {
      if (fits(x, y)) {
        return { x, y, room };
      }
    }
  }

  const contentBottom = occupied.reduce((bottom, rect) => Math.max(bottom, rect.bottom), 0);
  const x = NEW_TABLE_MARGIN + halfWidth;
  const y = Math.round(contentBottom + NEW_TABLE_GAP + halfHeight);
  const height = clamp(Math.max(room.height, y + halfHeight + NEW_TABLE_MARGIN), ROOM_MIN_HEIGHT, ROOM_MAX_SIZE);

  return { x, y: Math.min(y, height - halfHeight - ROOM_WALL_MARGIN), room: { width: room.width, height } };
}

/** One seat around a rectangular table: its side, and how far along it (0..1, left to right or top to bottom). */
export type RectSeatSpot = { side: "top" | "right" | "bottom" | "left"; along: number };

/**
 * Where each seat (in seat-number order, clockwise from the top-left) goes
 * around a rectangular table. Long, narrow tables seat people along their two
 * long sides only, like banquet tables; squarer tables seat all four sides in
 * proportion to each side's length.
 */
export function rectSeatSpots(capacity: number, width: number, height: number): RectSeatSpot[] {
  const sides = ["top", "right", "bottom", "left"] as const;
  const lengths = [width, height, width, height];
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  let counts: number[];

  if (long >= short * 1.5 || capacity <= 2) {
    const first = Math.ceil(capacity / 2);
    const second = capacity - first;
    counts = width >= height ? [first, 0, second, 0] : [0, first, 0, second];
  } else {
    const perimeter = 2 * (width + height);
    const shares = lengths.map((length) => (capacity * length) / perimeter);
    counts = shares.map(Math.floor);
    const order = shares
      .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
      .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    for (let left = capacity - counts.reduce((sum, count) => sum + count, 0), i = 0; left > 0; left -= 1, i += 1) {
      counts[order[i % order.length].index] += 1;
    }
  }

  return sides.flatMap((side, sideIndex) =>
    Array.from({ length: counts[sideIndex] }, (_, index) => {
      const along = (index + 0.5) / counts[sideIndex];
      // Clockwise: the bottom runs right to left and the left side bottom to top.
      return { side, along: side === "bottom" || side === "left" ? 1 - along : along };
    }),
  );
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
// 12-seat scale (1..11), whatever the table's real capacity. Pale cream when nearly empty, warming through yellow
// and lime, with deliberately bigger jumps for 9, 10, and 11 so a table that is
// one or two short is easy to tell apart from a full one.
const FILLING_SCALE = 12;
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

  const stepIndex = clamp(Math.round((count / capacity) * FILLING_SCALE), 1, FILLING_STEPS.length) - 1;
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

/** A whole party matches like partyMatchesSearch; a split person by their own name or their invitation's. */
export function unitMatchesSearch(unit: SeatingUnit, tokens: readonly string[]) {
  return partyMatchesSearch({ name: `${unit.party.name} ${unit.name}`, attendees: unit.attendees }, tokens);
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
 * invitations are left out. Split parties list each person at their own table.
 */
export function makeSeatingCsv(data: Omit<SeatingChartData, "areas" | "tableCapacity">) {
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
  const tableIds = new Set(data.tables.map((table) => table.id));
  const units = seatingUnits(data.parties)
    .filter((unit) => partySeats(unit) > 0)
    .sort(compareUnitsAtTable);

  function personRows(unit: SeatingUnit) {
    const { party } = unit;

    return unitPositions(unit).map((position) => {
      const attendee = party.attendees[position - 1];

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
    const people = units.filter((unit) => unit.tableId === table.id).flatMap(personRows);
    const seated = people.filter((person) => person.seat !== null).sort((a, b) => a.seat! - b.seat!);
    const unseated = people.filter((person) => person.seat === null);

    for (const person of [...seated, ...unseated]) {
      // Only unlabeled tables fall back to a generic name, so the name column stays the typed name.
      rows.push([table.number, table.name || (table.number ? "" : tableTitle(table)), person.seat ?? "", ...person.cells]);
    }
  }

  // Not seated: loose people (including anyone in a bubble) first, then each
  // named bucket in the order it was made.
  const buckets = data.buckets.filter((bucket) => !bucket.bubble).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const bucketRank = new Map(buckets.map((bucket, index) => [bucket.id, index + 1]));
  const bucketOf = (unit: SeatingUnit) => (unit.tableId ? bucketRank.get(unit.tableId) ?? 0 : 0);
  const unseatedUnits = units
    .filter((unit) => !(unit.tableId && tableIds.has(unit.tableId)))
    .sort(
      (a, b) =>
        bucketOf(a) - bucketOf(b) ||
        a.sortOrder - b.sortOrder ||
        a.partyId - b.partyId ||
        (a.position ?? 0) - (b.position ?? 0),
    );

  for (const unit of unseatedUnits) {
    const bucket = buckets[bucketOf(unit) - 1];
    const label = bucket ? `Not seated: ${bucketTitle(bucket)}` : "Not seated";

    for (const person of personRows(unit)) {
      rows.push(["", label, "", ...person.cells]);
    }
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
