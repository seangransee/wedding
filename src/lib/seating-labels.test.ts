import assert from "node:assert/strict";
import test from "node:test";
import {
  labelConflict,
  parseLabelList,
  tablesWithLabels,
  type SeatingLabel,
} from "./seating-labels.ts";
import type { SeatingTable } from "./seating.ts";

const table: SeatingTable = {
  id: "table-a",
  kind: "round",
  number: "legacy",
  name: "legacy",
  capacity: 12,
  x: 300,
  y: 300,
  width: 220,
  height: 220,
  createdAt: 1,
};
const label = (
  id: string,
  kind: "name" | "number",
  value: string,
  tableId: string | null = table.id,
): SeatingLabel => ({
  id,
  kind,
  value,
  tableId,
  x: null,
  y: null,
  createdAt: 1,
});

test("one name and number coexist; multiple labels of the same kind flag a conflict without losing values", () => {
  const labels = [label("1", "name", "Kyoto"), label("2", "number", "02A")];
  assert.equal(labelConflict(labels), "");
  labels.push(label("3", "name", "Paris"), label("4", "number", "VIP"));
  assert.equal(labelConflict(labels), "2 names · 2 numbers");
  const [result] = tablesWithLabels([table], labels);
  assert.equal(result.name, "Kyoto / Paris");
  assert.equal(result.number, "02A / VIP");
});

test("moving labels between tables, the floor and the list updates titles without stale legacy labels", () => {
  const second = { ...table, id: "table-b" };
  const labels = [label("1", "name", "Kyoto"), label("2", "name", "Paris")];
  labels[0] = { ...labels[0], tableId: second.id };
  let result = tablesWithLabels([table, second], labels);
  assert.deepEqual(
    result.map((table) => table.name),
    ["Paris", "Kyoto"],
  );
  labels[1] = { ...labels[1], tableId: null, x: -200, y: 1200 };
  result = tablesWithLabels([table, second], labels);
  assert.equal(result[0].name, "");
  assert.equal(result[0].number, "");
  labels[1] = { ...labels[1], x: null, y: null };
  assert.equal(tablesWithLabels([table], labels)[0].name, "");
});

test("bulk lists preserve free-form strings, punctuation, leading zeros and intentional duplicates", () => {
  assert.deepEqual(
    parseLabelList("  001\r\n2A\nHead table\n\n001 ", "number"),
    {
      values: ["001", "2A", "Head table", "001"],
      error: "",
    },
  );
  assert.deepEqual(parseLabelList("Paris, France\nSt. John's", "name").values, [
    "Paris, France",
    "St. John's",
  ]);
  assert.ok(parseLabelList("A".repeat(13), "number").error);
  assert.ok(parseLabelList("A".repeat(41), "name").error);
  assert.ok(parseLabelList(Array(101).fill("A").join("\n"), "name").error);
});
