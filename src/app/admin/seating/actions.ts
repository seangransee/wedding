"use server";

import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, ADMIN_PASSWORD } from "@/lib/cookies";
import {
  createSeatingArea,
  createSeatingBucket,
  createSeatingTable,
  deleteEmptySeatingBubbles,
  deleteSeatingAreaById,
  deleteSeatingTableById,
  getSeatingChart,
  replaceSeatingTableSeats,
  setSeatingAssignment,
  setSeatingPersonAssignment,
  splitSeatingParty,
  updateSeatingAreaName,
  updateSeatingAreaRect,
  updateSeatingRoomSize,
  updateSeatingTableLabel,
  updateSeatingTablePosition,
} from "@/lib/db";
import {
  AREA_MIN_SIZE,
  BUCKET_COORD_MAX,
  BUCKET_COORD_MIN,
  isUuid,
  normalizeAreaName,
  normalizeTableName,
  normalizeTableNumber,
  ROOM_MAX_SIZE,
  ROOM_MIN_HEIGHT,
  ROOM_MIN_WIDTH,
  type SeatingChartData,
} from "@/lib/seating";

// Seating data only shows on /admin/seating, whose client keeps its own state,
// so these actions skip revalidatePath to avoid re-rendering on every drag.

export type SeatingActionResult = {
  ok: boolean;
  message: string;
};

const RELOAD_HINT = "Reload to see the latest seating chart.";

async function requireAdmin() {
  const cookieStore = await cookies();

  if (cookieStore.get(ADMIN_COOKIE_NAME)?.value !== ADMIN_PASSWORD) {
    throw new Error("Admin login required.");
  }
}

function isGuestId(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isCoordinate(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= ROOM_MAX_SIZE;
}

function isBucketCoordinate(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= BUCKET_COORD_MIN && (value as number) <= BUCKET_COORD_MAX;
}

function isRoomSize(value: unknown, min: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= ROOM_MAX_SIZE;
}

function ok(message: string): SeatingActionResult {
  return { ok: true, message };
}

function fail(message: string): SeatingActionResult {
  return { ok: false, message };
}

export async function loadSeatingChart(): Promise<SeatingChartData> {
  await requireAdmin();
  return getSeatingChart();
}

/** Seats a whole party (joining it back together if it was split), or unseats it. */
export async function seatParty(guestId: number, tableId: string | null): Promise<SeatingActionResult> {
  await requireAdmin();

  if (!isGuestId(guestId) || (tableId !== null && !isUuid(tableId))) {
    return fail("That seat change was invalid.");
  }

  const saved = await setSeatingAssignment(guestId, tableId);
  await deleteEmptySeatingBubbles();

  return saved ? ok("Seat saved.") : fail(`That guest or table no longer exists. ${RELOAD_HINT}`);
}

function isPosition(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 10;
}

/** Splits a party so people 1..peopleCount can sit at different tables. */
export async function splitParty(guestId: number, peopleCount: number): Promise<SeatingActionResult> {
  await requireAdmin();

  if (!isGuestId(guestId) || !isPosition(peopleCount)) {
    return fail("That split was invalid.");
  }

  const saved = await splitSeatingParty(guestId, peopleCount);

  return saved ? ok("Party split.") : fail(`That guest no longer exists. ${RELOAD_HINT}`);
}

/** Seats (or unseats) one person from a split party. */
export async function seatPerson(
  guestId: number,
  position: number,
  tableId: string | null,
): Promise<SeatingActionResult> {
  await requireAdmin();

  if (!isGuestId(guestId) || !isPosition(position) || (tableId !== null && !isUuid(tableId))) {
    return fail("That seat change was invalid.");
  }

  const saved = await setSeatingPersonAssignment(guestId, position, tableId);
  await deleteEmptySeatingBubbles();

  return saved
    ? ok("Seat saved.")
    : fail(`That party was put back together or the table no longer exists. ${RELOAD_HINT}`);
}

function labelText(value: unknown) {
  return typeof value === "string" ? value : null;
}

export async function addSeatingTable(input: {
  id: string;
  number: string;
  name: string;
  x: number;
  y: number;
}): Promise<SeatingActionResult> {
  await requireAdmin();

  const number = labelText(input?.number);
  const name = labelText(input?.name);

  if (!isUuid(input?.id) || number === null || name === null || !isCoordinate(input.x) || !isCoordinate(input.y)) {
    return fail("That new table was invalid.");
  }

  await createSeatingTable({
    id: input.id,
    number: normalizeTableNumber(number),
    name: normalizeTableName(name),
    x: input.x,
    y: input.y,
  });
  return ok("Table added.");
}

/** Adds a named bucket, or (bubble: true) a little unnamed bubble dropped on the floor. */
export async function addSeatingBucket(input: {
  id: string;
  name: string;
  x: number;
  y: number;
  bubble?: boolean;
}): Promise<SeatingActionResult> {
  await requireAdmin();

  const name = labelText(input?.name);

  if (!isUuid(input?.id) || name === null || !isBucketCoordinate(input.x) || !isBucketCoordinate(input.y)) {
    return fail("That new bucket was invalid.");
  }

  const bubble = input.bubble === true;
  await createSeatingBucket({ id: input.id, name: normalizeTableName(name), x: input.x, y: input.y, bubble });
  return ok(bubble ? "Bubble added." : "Bucket added.");
}

/** Buckets can sit outside the room, so they take a wider coordinate range than tables. */
export async function moveSeatingBucket(bucketId: string, x: number, y: number): Promise<SeatingActionResult> {
  await requireAdmin();

  if (!isUuid(bucketId) || !isBucketCoordinate(x) || !isBucketCoordinate(y)) {
    return fail("That bucket position was invalid.");
  }

  const saved = await updateSeatingTablePosition(bucketId, x, y);

  return saved ? ok("Bucket moved.") : fail(`That bucket no longer exists. ${RELOAD_HINT}`);
}

export async function moveSeatingTable(
  tableId: string,
  x: number,
  y: number,
): Promise<SeatingActionResult> {
  await requireAdmin();

  if (!isUuid(tableId) || !isCoordinate(x) || !isCoordinate(y)) {
    return fail("That table position was invalid.");
  }

  const saved = await updateSeatingTablePosition(tableId, x, y);

  return saved ? ok("Table moved.") : fail(`That table no longer exists. ${RELOAD_HINT}`);
}

export async function labelSeatingTable(
  tableId: string,
  number: string,
  name: string,
): Promise<SeatingActionResult> {
  await requireAdmin();

  const numberText = labelText(number);
  const nameText = labelText(name);

  if (!isUuid(tableId) || numberText === null || nameText === null) {
    return fail("That table label was invalid.");
  }

  const saved = await updateSeatingTableLabel(
    tableId,
    normalizeTableNumber(numberText),
    normalizeTableName(nameText),
  );

  return saved ? ok("Table label saved.") : fail(`That table no longer exists. ${RELOAD_HINT}`);
}

/** Replaces the optional exact seats at one table (an empty list clears them). */
export async function saveTableSeats(
  tableId: string,
  seats: Array<{ seatNumber: number; partyId: number; position: number }>,
): Promise<SeatingActionResult> {
  await requireAdmin();

  const valid =
    isUuid(tableId) &&
    Array.isArray(seats) &&
    seats.length <= 30 &&
    seats.every(
      (seat) =>
        Number.isInteger(seat?.seatNumber) &&
        seat.seatNumber >= 1 &&
        seat.seatNumber <= 30 &&
        isGuestId(seat.partyId) &&
        Number.isInteger(seat.position) &&
        seat.position >= 1 &&
        seat.position <= 10,
    );

  if (!valid) {
    return fail("Those seats were invalid.");
  }

  const result = await replaceSeatingTableSeats(
    tableId,
    seats.map((seat) => ({ seatNumber: seat.seatNumber, partyId: seat.partyId, position: seat.position })),
  );

  if (!result.tableExists) {
    return fail(`That table no longer exists. ${RELOAD_HINT}`);
  }

  if (result.savedCount !== seats.length) {
    return fail(`Some seats couldn't be saved because a party moved. ${RELOAD_HINT}`);
  }

  return ok("Seats saved.");
}

export async function deleteSeatingTable(tableId: string): Promise<SeatingActionResult> {
  await requireAdmin();

  if (!isUuid(tableId)) {
    return fail("That table was invalid.");
  }

  const result = await deleteSeatingTableById(tableId);

  if (result === "protected") {
    return fail("The sweetheart table can't be deleted.");
  }

  // Deleting an already-deleted table or bucket is fine (e.g. a retried save).
  return ok("Deleted.");
}

export async function resizeSeatingRoom(width: number, height: number): Promise<SeatingActionResult> {
  await requireAdmin();

  if (!isRoomSize(width, ROOM_MIN_WIDTH) || !isRoomSize(height, ROOM_MIN_HEIGHT)) {
    return fail("That room size was invalid.");
  }

  await updateSeatingRoomSize(width, height);
  return ok("Room resized.");
}

function isAreaRect(value: unknown): value is { x: number; y: number; width: number; height: number } {
  const rect = value as { x?: unknown; y?: unknown; width?: unknown; height?: unknown } | null;

  return (
    typeof rect === "object" &&
    rect !== null &&
    isCoordinate(rect.x) &&
    isCoordinate(rect.y) &&
    isRoomSize(rect.width, AREA_MIN_SIZE) &&
    isRoomSize(rect.height, AREA_MIN_SIZE)
  );
}

/** Adds a named floor area, like the stage or dance floor. */
export async function addSeatingArea(input: {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<SeatingActionResult> {
  await requireAdmin();

  const name = labelText(input?.name);

  if (!isUuid(input?.id) || name === null || !isAreaRect(input)) {
    return fail("That new area was invalid.");
  }

  await createSeatingArea({
    id: input.id,
    name: normalizeAreaName(name),
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
  });
  return ok("Area added.");
}

/** Moves and/or resizes a floor area. */
export async function updateSeatingArea(
  areaId: string,
  rect: { x: number; y: number; width: number; height: number },
): Promise<SeatingActionResult> {
  await requireAdmin();

  if (!isUuid(areaId) || !isAreaRect(rect)) {
    return fail("That area size or position was invalid.");
  }

  const saved = await updateSeatingAreaRect(areaId, rect.x, rect.y, rect.width, rect.height);

  return saved ? ok("Area saved.") : fail(`That area no longer exists. ${RELOAD_HINT}`);
}

export async function renameSeatingArea(areaId: string, name: string): Promise<SeatingActionResult> {
  await requireAdmin();

  const nameText = labelText(name);

  if (!isUuid(areaId) || nameText === null) {
    return fail("That area name was invalid.");
  }

  const saved = await updateSeatingAreaName(areaId, normalizeAreaName(nameText));

  return saved ? ok("Area renamed.") : fail(`That area no longer exists. ${RELOAD_HINT}`);
}

export async function deleteSeatingArea(areaId: string): Promise<SeatingActionResult> {
  await requireAdmin();

  if (!isUuid(areaId)) {
    return fail("That area was invalid.");
  }

  // Deleting an already-deleted area is fine (e.g. a retried save).
  await deleteSeatingAreaById(areaId);
  return ok("Area deleted.");
}
