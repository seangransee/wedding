"use client";

import * as Dialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import { ArrowRight, Check, Heart, Plus, Search, Trash2, UserMinus, Wand2, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import {
  fullnessStyle,
  isPartyUnconfirmed,
  partyMatchesSearch,
  partySeats,
  partyStatusLabel,
  personKey,
  personLabel,
  searchTokens,
  shortPersonLabel,
  TABLE_NAME_MAX_LENGTH,
  TABLE_NUMBER_MAX_LENGTH,
  tableFullTitle,
  tableTitle,
  type SeatingMealType,
  type SeatingParty,
  type SeatingSeat,
} from "@/lib/seating";
import {
  FullnessBadge,
  partyCardClasses,
  PartySeatsBadge,
  PartyStatusIcon,
  type TableSummary,
} from "./seating-ui";

function Sheet({
  children,
  description,
  onClose,
  onOpenAutoFocus,
  title,
}: {
  children: ReactNode;
  description: ReactNode;
  onClose: () => void;
  onOpenAutoFocus?: (event: Event) => void;
  title: ReactNode;
}) {
  return (
    <Dialog.Root open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="seating-dialog-overlay fixed inset-0 z-50 bg-[#4a1027]/40 backdrop-blur-[2px]" />
        <Dialog.Content
          className="seating-dialog-content fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl border border-[#df7fa3] bg-[#fff8fb] text-[#4a1027] shadow-[0_-24px_60px_-30px_rgba(74,16,39,0.8)] outline-none md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[88dvh] md:w-[min(94vw,36rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl"
          onOpenAutoFocus={onOpenAutoFocus}
        >
          <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-[#efb5c9] md:hidden" aria-hidden="true" />
          <div className="flex shrink-0 items-start gap-3 border-b border-[#f3cddb] px-5 pb-3 pt-3 md:pt-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-2xl font-semibold leading-tight text-[#4a1027]">{title}</Dialog.Title>
              <Dialog.Description asChild>
                <div className="mt-1 text-sm text-[#8f5070]">{description}</div>
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-[#efb5c9] bg-white text-[#7a1239] transition hover:bg-[#ffe0ec]"
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
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
  return null;
}

function peopleText(party: SeatingParty) {
  const seats = partySeats(party);

  if (party.status === "no") {
    return "Not coming";
  }

  if (isPartyUnconfirmed(party)) {
    return `up to ${seats} ${seats === 1 ? "person" : "people"}`;
  }

  return `${seats} ${seats === 1 ? "person" : "people"}`;
}

export function PartyDialog({
  currentSummary,
  onAssign,
  onClose,
  onOpenTable,
  party,
  seatNumbers,
  summaries,
}: {
  currentSummary: TableSummary | null;
  onAssign: (tableId: string | null) => void;
  onClose: () => void;
  onOpenTable: (tableId: string) => void;
  party: SeatingParty;
  seatNumbers: number[] | undefined;
  summaries: TableSummary[];
}) {
  const seats = partySeats(party);
  const people = Array.from({ length: seats }, (_, index) => {
    const attendee = party.attendees[index];
    return {
      label: personLabel(party, index + 1),
      details: [mealLabel(attendee?.mealType ?? null), attendee?.dietaryNotes || null].filter(Boolean).join(" · "),
    };
  });

  return (
    <Sheet
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 font-semibold">
            <PartyStatusIcon size={15} status={party.status} />
            {partyStatusLabel(party.status)}
          </span>
          <span>· {peopleText(party)}</span>
          <span>
            ·{" "}
            {currentSummary ? (
              <button
                type="button"
                className="font-semibold text-[#9f1d52] underline decoration-dashed underline-offset-4"
                onClick={() => onOpenTable(currentSummary.table.id)}
              >
                {tableFullTitle(currentSummary.table)}
              </button>
            ) : (
              "Not seated"
            )}
            {seatNumbers?.length ? ` (${seatNumbers.length === 1 ? "seat" : "seats"} ${seatNumbers.join(", ")})` : ""}
          </span>
        </span>
      }
      onClose={onClose}
      onOpenAutoFocus={(event) => event.preventDefault()}
      title={party.name}
    >
      {seats > 0 ? (
        <ul className="mb-4 grid grid-cols-[minmax(0,1fr)] gap-1 rounded-2xl border border-[#f3cddb] bg-white px-3 py-2 text-sm">
          {people.map((person, index) => (
            <li key={index} className="flex items-baseline justify-between gap-3">
              <span className={clsx("font-semibold", isPartyUnconfirmed(party) && "italic text-[#6b4a5a]")}>
                {person.label}
              </span>
              {person.details ? <span className="text-right text-xs text-[#8f5070]">{person.details}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {isPartyUnconfirmed(party) ? (
        <p className="mb-4 rounded-2xl border border-dashed border-[#d97706] bg-[#fffbeb] px-3 py-2 text-sm text-[#8a3b06]">
          Unconfirmed: they haven&apos;t said yes yet, so tables count their full invitation ({seats}).
        </p>
      ) : null}

      <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#8f5070]">Seat at</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {summaries.map((summary) => {
          const current = summary.table.id === party.tableId;
          const nextCount = current ? summary.count : summary.count + seats;
          const nextStyle = fullnessStyle(nextCount, summary.table.capacity);

          return (
            <button
              key={summary.table.id}
              type="button"
              disabled={current}
              className={clsx(
                "flex min-h-14 items-center gap-3 rounded-2xl border px-3 py-2 text-left transition",
                current
                  ? "border-[#be185d] bg-[#ffe0ec]"
                  : "border-[#efb5c9] bg-white hover:-translate-y-px hover:border-[#be185d] hover:shadow-[0_8px_18px_-12px_rgba(74,16,39,0.7)]",
              )}
              onClick={() => onAssign(summary.table.id)}
            >
              <span
                className={clsx(
                  "grid size-10 shrink-0 place-items-center rounded-full border-2 text-sm font-bold tabular-nums",
                  nextStyle.tone === "empty" && "border-dashed",
                  nextStyle.tone === "over" && "seating-over-stripes",
                )}
                style={{ backgroundColor: nextStyle.background, borderColor: nextStyle.border, color: nextStyle.text }}
              >
                {summary.table.kind === "sweetheart" ? (
                  <Heart aria-hidden="true" className="fill-current" size={15} />
                ) : (
                  summary.table.number || "?"
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={clsx("block truncate font-semibold", !summary.table.number && !summary.table.name && "italic")}>
                  {tableFullTitle(summary.table)}
                </span>
                <span className="flex items-center gap-1 text-xs tabular-nums text-[#8f5070]">
                  {current ? (
                    <>
                      <Check aria-hidden="true" size={13} className="text-[#047857]" /> Here now · {summary.count}/
                      {summary.table.capacity}
                    </>
                  ) : (
                    <>
                      {summary.count}/{summary.table.capacity}
                      <ArrowRight aria-hidden="true" size={12} />
                      <span className={clsx("font-bold", nextStyle.tone === "over" ? "text-[#b91c1c]" : "text-[#4a1027]")}>
                        {nextCount}/{summary.table.capacity}
                        {nextStyle.tone === "over" ? " · over" : nextStyle.tone === "full" ? " · full" : ""}
                      </span>
                    </>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {party.tableId ? (
        <button
          type="button"
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#a04670] bg-white px-3 text-sm font-semibold text-[#7a1239] transition hover:bg-[#ffeaf2]"
          onClick={() => onAssign(null)}
        >
          <UserMinus size={16} aria-hidden="true" />
          Move to Not seated
        </button>
      ) : null}
    </Sheet>
  );
}

type SeatPerson = {
  key: string;
  partyId: number;
  position: number;
  label: string;
  shortLabel: string;
  unconfirmed: boolean;
};

type SeatSelection = { kind: "person"; key: string } | { kind: "seat"; seatNumber: number } | null;

export function TableDialog({
  autoFocusLabel,
  duplicateNumber,
  onAssignParty,
  onClose,
  onDelete,
  onLabel,
  onOpenParty,
  onSetSeats,
  seats,
  summary,
  unseatedParties,
}: {
  autoFocusLabel: boolean;
  duplicateNumber: (number: string) => boolean;
  onAssignParty: (partyId: number, tableId: string | null) => void;
  onClose: () => void;
  onDelete: () => void;
  onLabel: (number: string, name: string) => void;
  onOpenParty: (partyId: number) => void;
  onSetSeats: (seats: SeatingSeat[]) => void;
  seats: SeatingSeat[];
  summary: TableSummary;
  unseatedParties: SeatingParty[];
}) {
  const { table } = summary;
  const [number, setNumber] = useState(table.number);
  const [name, setName] = useState(table.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const numberInputRef = useRef<HTMLInputElement>(null);
  const savedLabelRef = useRef({ number: table.number, name: table.name });
  const coming = summary.parties.filter((party) => partySeats(party) > 0);
  const declined = summary.parties.filter((party) => partySeats(party) === 0);
  const addTokens = searchTokens(addQuery);
  const addCandidates = unseatedParties.filter((party) => partyMatchesSearch(party, addTokens));
  const isDuplicate = number.trim() !== "" && duplicateNumber(number.trim());

  function commitLabel() {
    const next = { number: number.trim(), name: name.trim() };

    if (next.number !== savedLabelRef.current.number || next.name !== savedLabelRef.current.name) {
      savedLabelRef.current = next;
      onLabel(next.number, next.name);
    }
  }

  function close() {
    commitLabel();
    onClose();
  }

  const people: SeatPerson[] = coming.flatMap((party) =>
    Array.from({ length: partySeats(party) }, (_, index) => ({
      key: personKey(party.id, index + 1),
      partyId: party.id,
      position: index + 1,
      label: personLabel(party, index + 1),
      shortLabel: shortPersonLabel(party, index + 1),
      unconfirmed: isPartyUnconfirmed(party),
    })),
  );

  return (
    <Sheet
      description={
        <span className="flex flex-wrap items-center gap-2">
          <FullnessBadge className="text-xs" summary={summary} />
          <span className="font-semibold">{summary.style.label}</span>
          {summary.unconfirmed ? <span>· {summary.unconfirmed} unconfirmed</span> : null}
        </span>
      }
      onClose={close}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        if (autoFocusLabel) {
          numberInputRef.current?.focus();
        }
      }}
      title={
        <span className="flex items-center gap-2">
          {table.kind === "sweetheart" ? <Heart aria-hidden="true" className="fill-[#be185d] text-[#be185d]" size={20} /> : null}
          {tableFullTitle({ ...table, number: number.trim(), name: name.trim() })}
        </span>
      }
    >
      <form
        className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-[#8f5070]">
          Table #
          <input
            ref={numberInputRef}
            className="h-12 w-full min-w-0 rounded-xl border border-[#df7fa3] bg-white px-3 text-xl font-semibold normal-case tracking-normal text-[#4a1027] outline-none transition placeholder:text-[#d3a6bb] focus:border-[#be185d] focus:ring-2 focus:ring-[#be185d]/20"
            enterKeyHint="next"
            maxLength={TABLE_NUMBER_MAX_LENGTH}
            onBlur={commitLabel}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="e.g. 7"
            value={number}
          />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.12em] text-[#8f5070]">
          Name (optional)
          <input
            className="h-12 w-full min-w-0 rounded-xl border border-[#df7fa3] bg-white px-3 text-lg normal-case tracking-normal text-[#4a1027] outline-none transition placeholder:text-[#d3a6bb] focus:border-[#be185d] focus:ring-2 focus:ring-[#be185d]/20"
            enterKeyHint="done"
            maxLength={TABLE_NAME_MAX_LENGTH}
            onBlur={commitLabel}
            onChange={(event) => setName(event.target.value)}
            placeholder={table.kind === "sweetheart" ? "Sweetheart table" : "e.g. College friends"}
            value={name}
          />
        </label>
        {isDuplicate ? (
          <p className="col-span-2 -mt-1 text-sm font-semibold text-[#b45309]">Another table is also number {number.trim()}.</p>
        ) : null}
        <button type="submit" className="sr-only">
          Save and close
        </button>
      </form>

      <section className="mt-5">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#8f5070]">
          At this table · {coming.length} {coming.length === 1 ? "party" : "parties"}
        </h3>
        {coming.length === 0 && declined.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#efb5c9] px-3 py-3 text-sm text-[#8f5070]">
            Nobody yet. Add parties below, or drag them onto the table.
          </p>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            {[...coming, ...declined].map((party) => (
              <li
                key={party.id}
                className={clsx(
                  "flex min-h-11 items-center gap-2 rounded-xl border-[1.5px] py-1 pl-2.5 pr-1",
                  partyCardClasses(party.status),
                )}
              >
                <PartyStatusIcon size={16} status={party.status} />
                <button
                  type="button"
                  className={clsx(
                    "min-w-0 flex-1 truncate text-left font-semibold",
                    isPartyUnconfirmed(party) && "italic",
                    party.status === "no" && "line-through",
                  )}
                  onClick={() => onOpenParty(party.id)}
                >
                  {party.name}
                  {party.status === "no" ? <span className="ml-1 text-xs not-italic">(declined)</span> : null}
                </button>
                <PartySeatsBadge className="text-sm" party={party} />
                <button
                  type="button"
                  aria-label={`Remove ${party.name} from this table`}
                  className="grid size-9 shrink-0 place-items-center rounded-full text-current opacity-70 transition hover:bg-black/5 hover:opacity-100"
                  onClick={() => onAssignParty(party.id, null)}
                  title="Move to Not seated"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#8f5070]">Add from Not seated</h3>
        {unseatedParties.length === 0 ? (
          <p className="text-sm text-[#8f5070]">Everyone who might come already has a table.</p>
        ) : (
          <>
            <label className="relative mb-2 flex items-center">
              <span className="sr-only">Search parties to add</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 text-[#a04670]" size={15} />
              <input
                className="h-11 w-full rounded-full border border-[#df7fa3] bg-white pl-9 pr-3 text-base outline-none transition placeholder:text-[#b9839c] focus:border-[#be185d] focus:ring-2 focus:ring-[#be185d]/20"
                onChange={(event) => setAddQuery(event.target.value)}
                placeholder="Search not-seated guests"
                type="search"
                value={addQuery}
              />
            </label>
            <div className="grid max-h-56 grid-cols-[minmax(0,1fr)] gap-1.5 overflow-y-auto overscroll-contain rounded-2xl border border-[#f3cddb] bg-white p-2">
              {addCandidates.length === 0 ? (
                <p className="px-1 py-2 text-sm text-[#8f5070]">No matches.</p>
              ) : (
                addCandidates.map((party) => (
                  <button
                    key={party.id}
                    type="button"
                    className={clsx(
                      "flex min-h-11 items-center gap-2 rounded-xl border-[1.5px] px-2.5 text-left transition hover:-translate-y-px",
                      partyCardClasses(party.status),
                    )}
                    onClick={() => onAssignParty(party.id, table.id)}
                  >
                    <Plus aria-hidden="true" size={16} className="shrink-0" />
                    <span className={clsx("min-w-0 flex-1 truncate font-semibold", isPartyUnconfirmed(party) && "italic")}>
                      {party.name}
                    </span>
                    <PartySeatsBadge className="text-sm" party={party} />
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </section>

      {people.length > 0 ? (
        <SeatPicker
          capacity={table.capacity}
          kind={table.kind}
          onSetSeats={onSetSeats}
          people={people}
          seats={seats}
          tableId={table.id}
        />
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#f3cddb] pt-4">
        {table.kind === "sweetheart" ? (
          <span className="text-xs text-[#8f5070]">The sweetheart table can&apos;t be deleted.</span>
        ) : confirmingDelete ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#991b1b]">
              Delete {tableTitle(table)}?{" "}
              {summary.parties.length ? `${summary.parties.length} ${summary.parties.length === 1 ? "party goes" : "parties go"} back to Not seated.` : ""}
            </span>
            <button
              type="button"
              className="min-h-10 rounded-full bg-[#b91c1c] px-4 text-sm font-bold text-white transition hover:bg-[#991b1b]"
              onClick={onDelete}
            >
              Delete
            </button>
            <button
              type="button"
              className="min-h-10 rounded-full border border-[#efb5c9] bg-white px-4 text-sm font-semibold text-[#7a1239]"
              onClick={() => setConfirmingDelete(false)}
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#fca5a5] bg-white px-4 text-sm font-semibold text-[#b91c1c] transition hover:bg-[#fef2f2]"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 size={15} aria-hidden="true" />
            Delete table
          </button>
        )}
        <button
          type="button"
          className="min-h-11 rounded-full border border-[#7a1239] bg-[#9f1d52] px-6 text-sm font-bold uppercase tracking-[0.1em] text-white transition hover:bg-[#bd2867]"
          onClick={close}
        >
          Done
        </button>
      </div>
    </Sheet>
  );
}

function seatPosition(seatNumber: number, capacity: number, kind: "round" | "sweetheart") {
  if (kind === "sweetheart") {
    // Side by side behind the table, facing the room.
    return { left: seatNumber === 1 ? 32 : 68, top: 24 };
  }

  const angle = ((seatNumber - 1) / capacity) * Math.PI * 2 - Math.PI / 2;
  return { left: 50 + Math.cos(angle) * 41, top: 50 + Math.sin(angle) * 41 };
}

/** Optional exact seats: tap a person then a seat (or a seat then a person). */
function SeatPicker({
  capacity,
  kind,
  onSetSeats,
  people,
  seats,
  tableId,
}: {
  capacity: number;
  kind: "round" | "sweetheart";
  onSetSeats: (seats: SeatingSeat[]) => void;
  people: SeatPerson[];
  seats: SeatingSeat[];
  tableId: string;
}) {
  const [selection, setSelection] = useState<SeatSelection>(null);
  const peopleByKey = new Map(people.map((person) => [person.key, person]));
  const occupantBySeat = new Map<number, SeatPerson>();
  const seatByPerson = new Map<string, number>();

  for (const seat of seats) {
    const person = peopleByKey.get(personKey(seat.partyId, seat.position));
    if (person) {
      occupantBySeat.set(seat.seatNumber, person);
      seatByPerson.set(person.key, seat.seatNumber);
    }
  }

  const unseatedPeople = people.filter((person) => !seatByPerson.has(person.key));
  const seatNumbers = Array.from({ length: capacity }, (_, index) => index + 1);

  function save(nextOccupants: Map<number, SeatPerson>) {
    onSetSeats(
      [...nextOccupants.entries()]
        .sort(([a], [b]) => a - b)
        .map(([seatNumber, person]) => ({
          tableId,
          seatNumber,
          partyId: person.partyId,
          position: person.position,
        })),
    );
  }

  function placePerson(person: SeatPerson, seatNumber: number) {
    const next = new Map(occupantBySeat);
    const previousSeat = seatByPerson.get(person.key);
    const displaced = next.get(seatNumber);

    if (previousSeat !== undefined) {
      next.delete(previousSeat);
      // Swap when moving someone onto an occupied seat.
      if (displaced && displaced.key !== person.key) {
        next.set(previousSeat, displaced);
      }
    }

    next.set(seatNumber, person);
    save(next);
    setSelection(null);
  }

  function clearSeat(seatNumber: number) {
    const next = new Map(occupantBySeat);
    next.delete(seatNumber);
    save(next);
    setSelection(null);
  }

  function handleSeatClick(seatNumber: number) {
    const occupant = occupantBySeat.get(seatNumber);

    if (selection?.kind === "person") {
      const person = peopleByKey.get(selection.key);
      if (person) {
        placePerson(person, seatNumber);
      }
      return;
    }

    if (selection?.kind === "seat") {
      if (selection.seatNumber === seatNumber) {
        setSelection(null);
        return;
      }

      const selectedOccupant = occupantBySeat.get(selection.seatNumber);
      if (selectedOccupant) {
        placePerson(selectedOccupant, seatNumber);
      } else if (occupant) {
        placePerson(occupant, selection.seatNumber);
      } else {
        setSelection({ kind: "seat", seatNumber });
      }
      return;
    }

    setSelection({ kind: "seat", seatNumber });
  }

  function handlePersonClick(person: SeatPerson) {
    if (selection?.kind === "seat") {
      placePerson(person, selection.seatNumber);
      return;
    }

    setSelection(selection?.kind === "person" && selection.key === person.key ? null : { kind: "person", key: person.key });
  }

  function autoFill() {
    const next = new Map(occupantBySeat);
    const openSeats = seatNumbers.filter((seatNumber) => !next.has(seatNumber));

    unseatedPeople.forEach((person, index) => {
      const seatNumber = openSeats[index];
      if (seatNumber !== undefined) {
        next.set(seatNumber, person);
      }
    });
    save(next);
    setSelection(null);
  }

  const selectedSeatOccupant = selection?.kind === "seat" ? occupantBySeat.get(selection.seatNumber) : undefined;
  const hint =
    selection?.kind === "person"
      ? `Now tap a seat for ${peopleByKey.get(selection.key)?.label ?? "them"}.`
      : selection?.kind === "seat"
        ? selectedSeatOccupant
          ? `Tap another seat to move ${selectedSeatOccupant.label}, or clear the seat.`
          : `Now tap a person for seat ${selection.seatNumber}.`
        : "Optional. Tap a person, then a seat (tap two seats to swap).";

  return (
    <section className="mt-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#8f5070]">
          Exact seats · {seatByPerson.size}/{people.length} placed
        </h3>
        <div className="flex gap-1.5">
          {unseatedPeople.length > 0 && occupantBySeat.size < capacity ? (
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[#df7fa3] bg-white px-3 text-xs font-semibold text-[#7a1239] transition hover:bg-[#ffeaf2]"
              onClick={autoFill}
            >
              <Wand2 size={13} aria-hidden="true" />
              Fill in order
            </button>
          ) : null}
          {occupantBySeat.size > 0 ? (
            <button
              type="button"
              className="inline-flex min-h-9 items-center rounded-full border border-[#df7fa3] bg-white px-3 text-xs font-semibold text-[#7a1239] transition hover:bg-[#ffeaf2]"
              onClick={() => {
                save(new Map());
                setSelection(null);
              }}
            >
              Clear seats
            </button>
          ) : null}
        </div>
      </div>
      <p className="mb-2 text-sm text-[#8f5070]" aria-live="polite">
        {hint}
      </p>

      <div
        className={clsx(
          "relative mx-auto w-full max-w-[22rem]",
          kind === "sweetheart" ? "aspect-[2/1]" : "aspect-square",
        )}
      >
        <div
          aria-hidden="true"
          className={clsx(
            "absolute border-2 border-[#efb5c9] bg-[#fff1f7]",
            kind === "sweetheart"
              ? "left-[18%] right-[18%] top-[52%] h-[30%] rounded-2xl"
              : "left-[28%] top-[28%] size-[44%] rounded-full",
          )}
        />
        {seatNumbers.map((seatNumber) => {
          const occupant = occupantBySeat.get(seatNumber);
          const position = seatPosition(seatNumber, capacity, kind);
          const selected =
            (selection?.kind === "seat" && selection.seatNumber === seatNumber) ||
            (selection?.kind === "person" && occupant?.key === selection.key);

          return (
            <button
              key={seatNumber}
              type="button"
              aria-label={`Seat ${seatNumber}${occupant ? `: ${occupant.label}` : ", empty"}`}
              className={clsx(
                "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-xl border-[1.5px] px-1 py-0.5 text-center leading-tight transition",
                kind === "sweetheart" ? "min-h-14 w-[30%]" : "min-h-11 w-[19%]",
                occupant
                  ? occupant.unconfirmed
                    ? "border-dashed border-[#d97706] bg-[#fffbeb] text-[#8a3b06]"
                    : "border-[#be185d] bg-white text-[#4a1027]"
                  : "border-dashed border-[#d6a9bd] bg-[#fffdfd] text-[#b9839c]",
                selected && "ring-4 ring-[#ec4899]/50",
                selection && !selected && "hover:border-[#be185d] hover:bg-[#ffeaf2]",
              )}
              onClick={() => handleSeatClick(seatNumber)}
              style={{ left: `${position.left}%`, top: `${position.top}%` }}
            >
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.08em] opacity-70">{seatNumber}</span>
              <span
                className={clsx(
                  "line-clamp-2 w-full break-words text-[0.7rem] font-semibold",
                  occupant?.unconfirmed && "italic",
                )}
              >
                {occupant ? occupant.shortLabel : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {selection?.kind === "seat" && selectedSeatOccupant ? (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[#df7fa3] bg-white px-3 text-xs font-semibold text-[#7a1239]"
            onClick={() => clearSeat(selection.seatNumber)}
          >
            <X size={13} aria-hidden="true" /> Clear seat {selection.seatNumber}
          </button>
        </div>
      ) : null}

      {people.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold text-[#8f5070]">
            {unseatedPeople.length ? `No seat yet (${unseatedPeople.length})` : "Everyone here has a seat."}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unseatedPeople.map((person) => {
              const selected = selection?.kind === "person" && selection.key === person.key;

              return (
                <button
                  key={person.key}
                  type="button"
                  className={clsx(
                    "min-h-9 rounded-full border-[1.5px] px-3 text-sm font-semibold transition",
                    person.unconfirmed
                      ? "border-dashed border-[#d97706] bg-[#fffbeb] italic text-[#8a3b06]"
                      : "border-[#d79ab4] bg-white text-[#4a1027]",
                    selected && "ring-4 ring-[#ec4899]/50",
                  )}
                  onClick={() => handlePersonClick(person)}
                >
                  {person.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
