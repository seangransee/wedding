/**
 * Fits every party chip inside a floor-plan table by picking the largest font
 * that lets all of them show in full. Chips sit one per line while that fits;
 * otherwise several share a line, and the font only shrinks when even packed
 * lines can't hold everyone. Sizes are room units (1 unit = 1 CSS pixel at
 * 100% zoom).
 */

/** Chip height per unit of font: line height plus vertical padding. */
export const CHIP_HEIGHT_EM = 1.37;
/** Chip border (top and bottom) in room units. */
export const CHIP_FIXED_HEIGHT = 2;
/** Vertical gap between chip lines, per unit of font. */
export const CHIP_LINE_GAP_EM = 0.16;
/** Horizontal gap between chips sharing a line, per unit of font. */
export const CHIP_GAP_EM = 0.25;
/** Space between the table header and the first chip line. */
export const CHIP_HEADER_GAP = 3;

/** How far the header plus chips may reach toward a round table's rim. */
const ROUND_BLOCK_REACH = 0.9;
const FONT_STEP = 0.96;

export type ChipLayoutInput = {
  /** Each chip's width per unit of font (name, padding, and headcount badge). */
  chipEms: readonly number[];
  /** Width every chip adds regardless of font (borders). */
  chipFixedWidth: number;
  headerHeight: number;
  maxFont: number;
  minFont: number;
} & (
  | {
      shape: "round";
      radius: number;
      /** The table's content box width, which caps even the widest chord. */
      maxLineWidth: number;
    }
  | { shape: "rect"; width: number; height: number }
);

export type ChipLayout = {
  fontSize: number;
  /** Chip indexes per line, top to bottom, in their original order. */
  lines: number[][];
  /** Room available to each line, so a chip can still truncate as a last resort. */
  lineWidths: number[];
  /** False only when even `minFont` couldn't show everyone in full. */
  fits: boolean;
};

/** Available width of each of `lineCount` lines at `font`, or null if they don't fit vertically. */
function lineSlots(input: ChipLayoutInput, lineCount: number, font: number): number[] | null {
  const chipHeight = CHIP_HEIGHT_EM * font + CHIP_FIXED_HEIGHT;
  const gap = CHIP_LINE_GAP_EM * font;
  const blockHeight = lineCount * chipHeight + Math.max(0, lineCount - 1) * gap;
  const totalHeight = input.headerHeight + CHIP_HEADER_GAP + blockHeight;

  if (input.shape === "rect") {
    return totalHeight <= input.height ? Array.from({ length: lineCount }, () => input.width) : null;
  }

  const radius = input.radius;
  // The header sits at the top of the centered block and needs some width too.
  if (totalHeight / 2 > radius * ROUND_BLOCK_REACH) {
    return null;
  }

  const widths: number[] = [];
  for (let line = 0; line < lineCount; line += 1) {
    const top = -totalHeight / 2 + input.headerHeight + CHIP_HEADER_GAP + line * (chipHeight + gap);
    const edge = Math.max(Math.abs(top), Math.abs(top + chipHeight));
    if (edge >= radius) {
      return null;
    }
    // Chord of the circle at the line's outer edge, less a little breathing room.
    widths.push(Math.min(input.maxLineWidth, 2 * Math.sqrt(radius * radius - edge * edge) - font * 0.6));
  }

  return widths;
}

function chipWidth(input: ChipLayoutInput, index: number, font: number) {
  return input.chipEms[index] * font + input.chipFixedWidth;
}

/**
 * Splits the chips, in order, into exactly `lineCount` non-empty lines that
 * each fit their line's width, or returns null when no split works.
 */
function packed(input: ChipLayoutInput, lineCount: number, font: number): ChipLayout | null {
  const count = input.chipEms.length;
  const widths = lineSlots(input, lineCount, font);
  if (!widths) {
    return null;
  }

  const gap = CHIP_GAP_EM * font;
  const chipWidths = input.chipEms.map((_, index) => chipWidth(input, index, font));
  // breakAt[line][end] = where the line starts when chips [0, end) fill lines [0, line].
  const breakAt: number[][] = Array.from({ length: lineCount }, () => new Array<number>(count + 1).fill(-1));
  for (let line = 0; line < lineCount; line += 1) {
    for (let end = line + 1; end <= count - (lineCount - 1 - line); end += 1) {
      let used = -gap;
      for (let start = end - 1; start >= line; start -= 1) {
        used += gap + chipWidths[start];
        if (used > widths[line]) {
          break;
        }
        if (line === 0 ? start === 0 : breakAt[line - 1][start] !== -1) {
          breakAt[line][end] = start;
          break;
        }
      }
    }
  }

  if (breakAt[lineCount - 1][count] === -1) {
    return null;
  }

  const lines: number[][] = [];
  let end = count;
  for (let line = lineCount - 1; line >= 0; line -= 1) {
    const start = breakAt[line][end];
    lines.unshift(Array.from({ length: end - start }, (_, offset) => start + offset));
    end = start;
  }

  return { fontSize: font, lines, lineWidths: widths, fits: true };
}

export function layoutTableChips(input: ChipLayoutInput): ChipLayout {
  const count = input.chipEms.length;
  if (count === 0) {
    return { fontSize: input.maxFont, lines: [], lineWidths: [], fits: true };
  }

  for (let font = input.maxFont; font >= input.minFont; font *= FONT_STEP) {
    // Prefer one chip per line, then as few chips per line as still fit.
    for (let lineCount = count; lineCount >= 1; lineCount -= 1) {
      const layout = packed(input, lineCount, font);
      if (layout) {
        return layout;
      }
    }
  }

  // Nothing fits even at the smallest font: still list everyone, one per line.
  const font = input.minFont;
  const fallbackWidth = input.shape === "round" ? input.maxLineWidth : input.width;
  const widths = lineSlots(input, count, font) ?? Array.from({ length: count }, () => fallbackWidth);

  return { fontSize: font, lines: widths.map((_, index) => [index]), lineWidths: widths, fits: false };
}
