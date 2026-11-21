import type { SeatingTable } from "./seating.ts";

export type SeatingLabelKind = "name" | "number";

export type SeatingLabel = {
  id: string;
  kind: SeatingLabelKind;
  value: string;
  tableId: string | null;
  /** Top-left room coordinates; both null while in the list or on a table. */
  x: number | null;
  y: number | null;
  createdAt: number;
};

export type LabelPlacement = Pick<SeatingLabel, "tableId" | "x" | "y">;

export const LABEL_WIDTH = 180;
export const LABEL_HEIGHT = 44;

export function labelsAtTable(
  labels: readonly SeatingLabel[],
  tableId: string,
) {
  return labels.filter((label) => label.tableId === tableId);
}

export function labelConflict(labels: readonly SeatingLabel[]) {
  const names = labels.filter((label) => label.kind === "name").length;
  const numbers = labels.filter((label) => label.kind === "number").length;
  return [
    names > 1 ? `${names} names` : "",
    numbers > 1 ? `${numbers} numbers` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Table titles, sorting and CSV all follow the independent labels. */
export function tablesWithLabels(
  tables: readonly SeatingTable[],
  labels: readonly SeatingLabel[],
): SeatingTable[] {
  return tables.map((table) => {
    const assigned = labelsAtTable(labels, table.id);
    return {
      ...table,
      name: assigned
        .filter((label) => label.kind === "name")
        .map((label) => label.value)
        .join(" / "),
      number: assigned
        .filter((label) => label.kind === "number")
        .map((label) => label.value)
        .join(" / "),
    };
  });
}

/** Newline-separated entries keep punctuation and arbitrary number strings. */
export function parseLabelList(text: string, kind: SeatingLabelKind) {
  const values = text
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const max = kind === "number" ? 12 : 40;
  if (values.some((value) => value.length > max)) {
    return { values: [], error: `Keep each ${kind} to ${max} characters.` };
  }
  if (values.length > 100) {
    return { values: [], error: "Add up to 100 labels at a time." };
  }
  return { values, error: "" };
}
