import assert from "node:assert/strict";
import test from "node:test";
import { layoutTableChips, type ChipLayoutInput } from "./seating-chip-layout.ts";

function round(chipEms: number[], maxFont = 18.5): ChipLayoutInput {
  return {
    chipEms,
    chipFixedWidth: 4,
    headerHeight: 40,
    maxFont,
    minFont: 3,
    shape: "round",
    radius: 102,
    maxLineWidth: 186,
  };
}

test("a few short names keep the full font, one per line", () => {
  const layout = layoutTableChips(round([5, 6, 7]));

  assert.equal(layout.fontSize, 18.5);
  assert.deepEqual(layout.lines, [[0], [1], [2]]);
  assert.equal(layout.fits, true);
});

test("a crowded table shrinks the font and keeps every chip", () => {
  const ems = [9.3, 11, 8, 9.5, 7.2, 10, 8.8, 9.9];
  const layout = layoutTableChips(round(ems));

  assert.ok(layout.fontSize < 18.5);
  assert.equal(layout.fits, true);
  assert.deepEqual(layout.lines.flat(), ems.map((_, index) => index));
});

test("twelve split people pack several to a line before shrinking further", () => {
  const ems = Array.from({ length: 12 }, () => 4.5);
  const layout = layoutTableChips(round(ems));

  assert.equal(layout.fits, true);
  assert.ok(layout.lines.length < 12);
  assert.deepEqual(layout.lines.flat(), ems.map((_, index) => index));
  layout.lines.forEach((line, lineIndex) => {
    const width = line.reduce((sum, index) => sum + ems[index] * layout.fontSize + 4, 0) +
      (line.length - 1) * 0.25 * layout.fontSize;
    assert.ok(width <= layout.lineWidths[lineIndex] + 1e-9);
  });
});

test("every chip fits at any headcount, and crowded tables get smaller text", () => {
  const fonts: number[] = [];
  for (let count = 1; count <= 16; count += 1) {
    const ems = Array.from({ length: count }, (_, index) => 6 + (index % 4));
    const layout = layoutTableChips(round(ems));
    assert.equal(layout.fits, true, `count ${count}`);
    assert.deepEqual(layout.lines.flat(), ems.map((_, index) => index));
    fonts.push(layout.fontSize);
  }

  assert.ok(fonts[15] < fonts[0]);
});

test("the sweetheart table uses its rectangle", () => {
  const layout = layoutTableChips({
    chipEms: [9.3],
    chipFixedWidth: 4,
    headerHeight: 30,
    maxFont: 18.5,
    minFont: 3,
    shape: "rect",
    width: 186,
    height: 74,
  });

  assert.equal(layout.fontSize, 18.5);
  assert.deepEqual(layout.lines, [[0]]);
});

test("parties with several names stack one per row when that keeps the font bigger", () => {
  // A long one-line family chip would force a tiny font; stacked, each row is short.
  const layout = layoutTableChips({
    ...round([24, 42, 9, 14]),
    stacked: { chipEms: [8, 9.5, 7.5, 14], rows: [2, 4, 1, 1] },
  });

  assert.equal(layout.stacked, true);
  assert.equal(layout.fits, true);
  assert.deepEqual(layout.lines, [[0], [1], [2], [3]]);
  assert.ok(layout.fontSize > layoutTableChips(round([24, 42, 9, 14])).fontSize);
});

test("single-name chips never use the stacked form", () => {
  const layout = layoutTableChips({ ...round([5, 6]), stacked: { chipEms: [5, 6], rows: [1, 1] } });

  assert.equal(layout.stacked, false);
});
