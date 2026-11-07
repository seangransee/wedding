"use client";

import clsx from "clsx";
import { CircleCheck, CircleHelp, CircleX, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  partySeats,
  partyStatusLabel,
  type FullnessStyle,
  type SeatingParty,
  type SeatingPartyStatus,
  type SeatingTable,
} from "@/lib/seating";

/** A table plus its parties and headcount, derived from client state. */
export type TableSummary = {
  table: SeatingTable;
  /** Every party at the table (declined ones included), in the order they were seated. */
  parties: SeatingParty[];
  /** People counted toward capacity: confirmed counts plus unconfirmed invitations. */
  count: number;
  /** People from maybe / no-reply invitations, included in count. */
  unconfirmed: number;
  style: FullnessStyle;
};

export type PartyDragData = {
  type: "party";
  partyId: number;
};

export type TableDragData = {
  type: "table";
  tableId: string;
};

export type DragData = PartyDragData | TableDragData;

export type DropData =
  | { type: "table"; tableId: string; area: "plan" | "list"; shape: "round" | "rect" }
  | { type: "unseated"; area: "list" }
  | { type: "room"; area: "plan" };

export function partyCardClasses(status: SeatingPartyStatus) {
  if (status === "yes") {
    return "border-solid border-[#d79ab4] bg-white text-[#4a1027]";
  }
  if (status === "deciding") {
    return "border-dashed border-[#d97706] bg-[#fffbeb] text-[#8a3b06]";
  }
  if (status === "no") {
    return "border-solid border-[#dc2626] bg-[#fef2f2] text-[#991b1b]";
  }
  return "border-dashed border-[#64748b] bg-[#f6f8fb] text-[#334155]";
}

export function PartyStatusIcon({
  className,
  size = 14,
  status,
}: {
  className?: string;
  size?: number;
  status: SeatingPartyStatus;
}) {
  const label = partyStatusLabel(status);

  if (status === "yes") {
    return <CircleCheck aria-label={label} className={clsx("shrink-0 text-[#047857]", className)} size={size} />;
  }
  if (status === "deciding") {
    return <CircleHelp aria-label={label} className={clsx("shrink-0 text-[#d97706]", className)} size={size} />;
  }
  if (status === "no") {
    return <CircleX aria-label={label} className={clsx("shrink-0 text-[#dc2626]", className)} size={size} />;
  }
  return <Clock3 aria-label={label} className={clsx("shrink-0 text-[#64748b]", className)} size={size} />;
}

/** "2" for a confirmed party, "4?" while the headcount is only the invitation's max. */
export function partySeatsLabel(party: SeatingParty) {
  if (party.status === "no") {
    return "0";
  }

  const seats = partySeats(party);
  return party.status === "yes" ? String(seats) : `${seats}?`;
}

export function PartySeatsBadge({ className, party }: { className?: string; party: SeatingParty }) {
  const confirmed = party.status === "yes";

  return (
    <span
      className={clsx(
        "inline-flex min-w-[1.6em] shrink-0 items-center justify-center rounded-full px-[0.4em] font-bold tabular-nums leading-[1.35]",
        confirmed && "bg-[#7a1239] text-white",
        party.status === "deciding" && "border border-dashed border-[#d97706] bg-[#fff7e6] text-[#8a3b06]",
        party.status === "none" && "border border-dashed border-[#64748b] bg-white text-[#334155]",
        party.status === "no" && "bg-[#fee2e2] text-[#991b1b] line-through",
        className,
      )}
    >
      {partySeatsLabel(party)}
    </span>
  );
}

export function partyAriaLabel(party: SeatingParty) {
  const seats = partySeats(party);
  const people = `${seats} ${seats === 1 ? "person" : "people"}`;

  return `${party.name}, ${people}, ${partyStatusLabel(party.status).toLowerCase()}`;
}

/** Headcount pill colored by how full the table is, e.g. "10/12". */
export function FullnessBadge({
  className,
  summary,
}: {
  className?: string;
  summary: Pick<TableSummary, "count" | "style"> & { table: Pick<SeatingTable, "capacity"> };
}) {
  const { style } = summary;

  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center rounded-full border px-2 font-bold tabular-nums leading-6",
        style.tone === "empty" && "border-dashed",
        style.tone === "over" && "seating-over-stripes",
        className,
      )}
      style={{ background: style.background, borderColor: style.border, color: style.text }}
    >
      {summary.count}/{summary.table.capacity}
    </span>
  );
}

/**
 * useState backed by localStorage for per-device UI preferences. Renders the
 * fallback on the server and first client render, then loads the stored value.
 */
export function useStoredState<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
) {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        const parsed: unknown = JSON.parse(stored);
        if (isValid(parsed)) {
          setValue(parsed);
        }
      }
    } catch {
      // Storage can be unavailable (private mode); fall back to defaults.
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage failures; the preference just won't persist.
    }
  }, [key, loaded, value]);

  return [value, setValue] as const;
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
