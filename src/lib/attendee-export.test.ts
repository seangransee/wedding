import assert from "node:assert/strict";
import test from "node:test";
import { formatExportAllergies, makeAttendeeCsv, prepareAttendeeExportRows, type ConfirmedAttendee } from "./attendee-export.ts";

function attendee(overrides: Partial<ConfirmedAttendee> = {}): ConfirmedAttendee {
  return {
    name: "Zoë Example", meal: "vegetarian", allergies: "", tableNumber: "01",
    tableName: "Montréal, Canada", invitedFriday: false, ...overrides,
  };
}

test("attendee CSV preserves punctuation, Unicode, whitespace and multiline allergy notes verbatim", () => {
  const allergies = '  + Peanuts, "tree nuts"\r\nNo dairy\n  ';
  const csv = makeAttendeeCsv([attendee({ allergies, invitedFriday: true })]);
  assert.equal(csv,
    '\uFEFF"Name","Meal","Allergies","Table number","Table name","Invited Friday?"\r\n' +
    '"Zoë Example","vegetarian","  + Peanuts, ""tree nuts""\r\nNo dairy\n  ","01","Montréal, Canada","true"\r\n');
});

test("attendee CSV uses a blank Friday value and leaves incomplete place cards, meals and tables blank", () => {
  assert.equal(makeAttendeeCsv([attendee({ name: "", meal: "", tableNumber: "", tableName: "" })])
    .split("\r\n")[1], '"","","","","",""');
});

test("empty attendee export still has the six requested headers", () => {
  assert.equal(makeAttendeeCsv([]),
    '\uFEFF"Name","Meal","Allergies","Table number","Table name","Invited Friday?"\r\n');
});

test("exports sort by integer table number, then first name, with full-name ties", () => {
  const rows = [
    attendee({name: "Zoe Adams", tableNumber: "2"}),
    attendee({name: "Aaron Zebra", tableNumber: "10"}),
    attendee({name: "Zoe Zebra", tableNumber: "02"}),
    attendee({name: "Aaron Smith", tableNumber: "2"}),
    attendee({name: "Lexi Lorimer", tableNumber: "1"}),
    attendee({name: "Aaron Missing", tableNumber: ""}),
    attendee({name: "Aaron Other", tableNumber: "Head"}),
    attendee({name: "Aaron Large", tableNumber: "51"}),
  ];
  assert.deepEqual(prepareAttendeeExportRows(rows).map((r) => r.name), [
    "Lexi Lorimer", "Aaron Smith", "Zoe Adams", "Zoe Zebra", "Aaron Zebra",
    "Aaron Large", "Aaron Other", "Aaron Missing",
  ]);
  assert.equal(rows[0].name, "Zoe Adams");
});

test("allergy notes become a single punctuated line while preserving their wording", () => {
  assert.equal(formatExportAllergies("Peanut allergy. \r\nAllergy to lack of babushka."),
    "Peanut allergy. Allergy to lack of babushka.");
  assert.equal(formatExportAllergies("  No dairy\nNo eggs\r\n\r\nNo nuts!  "),
    "No dairy. No eggs. No nuts!");
  assert.equal(formatExportAllergies("Celiac (needs to be gluten free)\r\n"),
    "Celiac (needs to be gluten free).");
  assert.equal(formatExportAllergies("None"), "None.");
  assert.equal(formatExportAllergies(" \r\n "), "");
  assert.equal(prepareAttendeeExportRows([attendee({allergies:"No dairy\nNo eggs"})])[0].allergies,
    "No dairy. No eggs.");
});
