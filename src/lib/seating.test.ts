import assert from "node:assert/strict";
import test from "node:test";
import {
  compareSeatingTables,
  currentSeats,
  findOpenTableSpot,
  fullnessStyle,
  makeSeatingCsv,
  minimumRoomSize,
  partyMatchesSearch,
  partySeats,
  searchTokens,
  shortPersonLabel,
  tableFullTitle,
  type SeatingParty,
  type SeatingTable,
} from "./seating.ts";

function table(overrides: Partial<SeatingTable> & Pick<SeatingTable, "id">): SeatingTable {
  return {
    kind: "round",
    number: "",
    name: "",
    capacity: 12,
    x: 146,
    y: 146,
    createdAt: 0,
    ...overrides,
  };
}

function party(overrides: Partial<SeatingParty> & Pick<SeatingParty, "id" | "name">): SeatingParty {
  return {
    status: "yes",
    guestCount: 2,
    attendingCount: 2,
    attendees: [],
    sortOrder: overrides.id,
    tableId: null,
    assignedAt: null,
    ...overrides,
  };
}

test("counts confirmed headcount for yes, the whole invitation for maybes, and nobody for no", () => {
  assert.equal(partySeats({ status: "yes", guestCount: 4, attendingCount: 3 }), 3);
  assert.equal(partySeats({ status: "deciding", guestCount: 4, attendingCount: null }), 4);
  assert.equal(partySeats({ status: "none", guestCount: 2, attendingCount: null }), 2);
  assert.equal(partySeats({ status: "no", guestCount: 2, attendingCount: null }), 0);
});

test("colors tables as empty, filling, full, or over", () => {
  assert.equal(fullnessStyle(0, 12).tone, "empty");
  assert.equal(fullnessStyle(0, 12).label, "Empty");
  assert.equal(fullnessStyle(9, 12).label, "3 open");
  assert.equal(fullnessStyle(12, 12).tone, "full");
  assert.equal(fullnessStyle(14, 12).tone, "over");
  assert.equal(fullnessStyle(14, 12).label, "2 over");
  assert.equal(fullnessStyle(2, 2).tone, "full");
  assert.equal(fullnessStyle(1, 2).label, "1 open");
});

test("gives 10, 11, and 12 people visibly different colors", () => {
  const backgrounds = new Set([10, 11, 12].map((count) => fullnessStyle(count, 12).background));
  assert.equal(backgrounds.size, 3);
});

test("sorts the sweetheart table first, then table numbers naturally, then unnumbered tables", () => {
  const tables = [
    table({ id: "c", number: "10" }),
    table({ id: "d", createdAt: 2 }),
    table({ id: "b", number: "2" }),
    table({ id: "e", createdAt: 1, name: "Kids" }),
    table({ id: "a", kind: "sweetheart", capacity: 2, name: "Sweetheart table" }),
  ];

  assert.deepEqual(
    tables.sort(compareSeatingTables).map((entry) => entry.id),
    ["a", "b", "c", "e", "d"],
  );
});

test("titles tables from their number and name", () => {
  assert.equal(tableFullTitle(table({ id: "a", number: "7", name: "College friends" })), "Table 7 · College friends");
  assert.equal(tableFullTitle(table({ id: "b", number: "7" })), "Table 7");
  assert.equal(tableFullTitle(table({ id: "c", name: "Kids" })), "Kids");
  assert.equal(tableFullTitle(table({ id: "d" })), "New table");
});

test("puts new tables in the first open grid spot and grows the room when it is full", () => {
  const room = { width: 1400, height: 1000 };

  assert.deepEqual(findOpenTableSpot(room, []), { x: 146, y: 146, room });
  assert.deepEqual(findOpenTableSpot(room, [{ kind: "round", x: 146, y: 146 }]), { x: 414, y: 146, room });

  const smallRoom = { width: 480, height: 360 };
  const spot = findOpenTableSpot(smallRoom, [{ kind: "round", x: 146, y: 146 }]);
  assert.equal(spot.x, 146);
  assert.ok(spot.y > 146 + 220, "new row goes below the existing table");
  assert.ok(spot.room.height >= spot.y + 110, "room grows to fit the new table");
});

test("never lets the room shrink past its tables", () => {
  assert.deepEqual(minimumRoomSize([]), { width: 480, height: 360 });
  assert.deepEqual(minimumRoomSize([{ kind: "round", x: 1218, y: 700 }]), { width: 1352, height: 834 });
});

test("labels seats with short names", () => {
  const holloways = party({ id: 1, name: "Jordan and Peyton Holloway + kids", guestCount: 4, attendingCount: 4 });
  const named = party({
    id: 2,
    name: "Sample Couple",
    attendees: [{ name: "Alex Sample", mealType: null, dietaryNotes: "" }],
  });

  assert.equal(shortPersonLabel(holloways, 2), "Holloway 2");
  assert.equal(shortPersonLabel(named, 1), "Alex S.");
  assert.equal(shortPersonLabel(party({ id: 3, name: "Logan Castillo", guestCount: 1, attendingCount: 1 }), 1), "Logan Castillo");
});

test("drops exact seats that no longer apply", () => {
  const tables = [table({ id: "t1" }), table({ id: "t2" })];
  const parties = [
    party({ id: 1, name: "A", tableId: "t1", attendingCount: 1, guestCount: 2 }),
    party({ id: 2, name: "B", tableId: "t2" }),
  ];
  const seats = [
    { tableId: "t1", seatNumber: 1, partyId: 1, position: 1 },
    { tableId: "t1", seatNumber: 2, partyId: 1, position: 2 }, // beyond the confirmed headcount
    { tableId: "t1", seatNumber: 3, partyId: 2, position: 1 }, // party moved to t2
    { tableId: "t2", seatNumber: 13, partyId: 2, position: 1 }, // past the table's capacity
  ];

  assert.deepEqual(currentSeats(seats, parties, tables), [seats[0]]);
});

test("matches search tokens against party and place-card names", () => {
  const sample = party({
    id: 1,
    name: "Sean and Lexi",
    attendees: [{ name: "Sean Gransee", mealType: null, dietaryNotes: "" }],
  });

  assert.equal(partyMatchesSearch(sample, searchTokens("lexi")), true);
  assert.equal(partyMatchesSearch(sample, searchTokens("  gransee  sean ")), true);
  assert.equal(partyMatchesSearch(sample, searchTokens("lexi smith")), false);
  assert.equal(partyMatchesSearch(sample, searchTokens("")), true);
});

test("exports one CSV row per person, seated people by seat, without declined guests", () => {
  const tables = [
    table({ id: "t7", number: "7", name: "College friends" }),
    table({ id: "t1", number: "1" }),
  ];
  const parties = [
    party({
      id: 1,
      name: "Sample Couple",
      tableId: "t7",
      assignedAt: 1,
      attendees: [
        { name: "Alex Sample", mealType: "vegetarian", dietaryNotes: "No mushrooms" },
        { name: "Jordan Sample", mealType: "beef", dietaryNotes: "" },
      ],
    }),
    party({ id: 2, name: "Logan Castillo", status: "deciding", guestCount: 1, attendingCount: null, tableId: "t1" }),
    party({ id: 3, name: "Declined Pair", status: "no", attendingCount: null, tableId: "t1" }),
    party({
      id: 4,
      name: "Unseated Friend",
      guestCount: 1,
      attendingCount: 1,
      attendees: [{ name: "=HYPERLINK(\"x\")", mealType: "fish", dietaryNotes: "" }],
    }),
  ];
  const seats = [{ tableId: "t7", seatNumber: 3, partyId: 1, position: 2 }];

  const rows = makeSeatingCsv({ room: { width: 1400, height: 1000 }, tables, parties, seats }).split("\r\n");

  assert.deepEqual(rows, [
    '"Table number","Table name","Seat","Guest","Invitation","RSVP","Meal","Dietary notes"',
    '"1","","","Logan Castillo","Logan Castillo","Maybe","",""',
    '"7","College friends","3","Jordan Sample","Sample Couple","Confirmed","Beef",""',
    '"7","College friends","","Alex Sample","Sample Couple","Confirmed","Vegetarian","No mushrooms"',
    '"","Not seated","","\'=HYPERLINK(""x"")","Unseated Friend","Confirmed","Fish",""',
  ]);
});
