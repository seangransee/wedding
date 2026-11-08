"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import clsx from "clsx";
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Heart,
  Inbox,
  LocateFixed,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { memo, type ReactNode } from "react";
import {
  bucketTitle,
  fullnessStyle,
  isPartyUnconfirmed,
  partySeats,
  partyStatusLabel,
  tableTitle,
  type SeatingUnit,
} from "@/lib/seating";
import {
  FullnessBadge,
  partyAriaLabel,
  partyCardClasses,
  PartySeatsBadge,
  PartyStatusIcon,
  type BucketSummary,
  type DropData,
  type PartyDragData,
  type TableSummary,
} from "./seating-ui";

export const UNSEATED_SECTION_ID = "unseated";

type SeatingSidebarProps = {
  bucketSummaries: BucketSummary[];
  className?: string;
  collapsedIds: ReadonlySet<string>;
  draggingUnitId: string | null;
  dropTarget: DropData | null;
  matchingUnitIds: ReadonlySet<string> | null;
  onLocateTable: (tableId: string) => void;
  onOpenBucket: (bucketId: string) => void;
  onOpenUnit: (unitId: string) => void;
  onOpenTable: (tableId: string) => void;
  onQueryChange: (query: string) => void;
  onSetAllCollapsed: (collapsed: boolean) => void;
  onToggleSection: (sectionId: string) => void;
  onHoverTable: (tableId: string | null) => void;
  previewCounts: ReadonlyMap<string, number>;
  query: string;
  seatNumbersByUnit: ReadonlyMap<string, number[]>;
  summaries: TableSummary[];
  unseatedUnits: SeatingUnit[];
};

const STATUS_GROUPS = [
  { status: "yes", title: "Confirmed" },
  { status: "deciding", title: "Maybe" },
  { status: "none", title: "No reply" },
] as const;

function peopleCount(parties: readonly SeatingUnit[]) {
  return parties.reduce((total, party) => total + partySeats(party), 0);
}

export function SeatingSidebar({
  bucketSummaries,
  className,
  collapsedIds,
  draggingUnitId,
  dropTarget,
  matchingUnitIds,
  onHoverTable,
  onLocateTable,
  onOpenBucket,
  onOpenUnit,
  onOpenTable,
  onQueryChange,
  onSetAllCollapsed,
  onToggleSection,
  previewCounts,
  query,
  seatNumbersByUnit,
  summaries,
  unseatedUnits,
}: SeatingSidebarProps) {
  const searching = matchingUnitIds !== null;
  const visibleUnseated = searching
    ? unseatedUnits.filter((party) => matchingUnitIds.has(party.id))
    : unseatedUnits;
  const visibleSummaries = searching
    ? summaries.filter((summary) => summary.units.some((party) => matchingUnitIds.has(party.id)))
    : summaries;
  const visibleBuckets = searching
    ? bucketSummaries.filter((summary) => summary.units.some((unit) => matchingUnitIds.has(unit.id)))
    : bucketSummaries;
  const allCollapsed =
    collapsedIds.has(UNSEATED_SECTION_ID) &&
    bucketSummaries.every((summary) => collapsedIds.has(summary.bucket.id)) &&
    summaries.every((summary) => collapsedIds.has(summary.table.id));
  const unseatedUnconfirmed = peopleCount(unseatedUnits.filter(isPartyUnconfirmed));
  const anyoneInBuckets = bucketSummaries.some((summary) => summary.units.length > 0);
  const noMatches =
    searching && visibleUnseated.length === 0 && visibleBuckets.length === 0 && visibleSummaries.length === 0;

  return (
    <aside className={clsx("flex min-h-0 flex-col bg-[#fff8fb]", className)}>
      <div className="flex items-center gap-2 border-b border-[#efb5c9] bg-[#fff1f7] px-3 py-2">
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">Search guests</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 text-[#a04670]" size={16} />
          <input
            className="h-10 w-full rounded-full border border-[#df7fa3] bg-white pl-8 pr-8 text-base text-[#4a1027] outline-none transition placeholder:text-[#b9839c] focus:border-[#be185d] focus:ring-2 focus:ring-[#be185d]/20"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search guests"
            type="search"
            value={query}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-1.5 grid size-7 place-items-center rounded-full text-[#a04670] hover:bg-[#ffe0ec]"
              onClick={() => onQueryChange("")}
            >
              <X size={15} aria-hidden="true" />
            </button>
          ) : null}
        </label>
        <button
          type="button"
          aria-label={allCollapsed ? "Expand all sections" : "Collapse all sections"}
          className="grid size-10 shrink-0 place-items-center rounded-full border border-[#df7fa3] bg-white text-[#7a1239] transition hover:bg-[#ffe0ec]"
          onClick={() => onSetAllCollapsed(!allCollapsed)}
          title={allCollapsed ? "Expand all" : "Collapse all"}
        >
          {allCollapsed ? <ChevronsUpDown size={17} aria-hidden="true" /> : <ChevronsDownUp size={17} aria-hidden="true" />}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+1rem)]" data-seating-clip>
        {noMatches ? (
          <p className="px-4 py-8 text-center text-base text-[#8f5070]">No guests match “{query.trim()}”.</p>
        ) : null}

        {!searching || visibleUnseated.length > 0 ? (
          <SidebarSection
            badge={
              <span className="rounded-full bg-[#7a1239] px-2 text-xs font-bold leading-6 tabular-nums text-white">
                {peopleCount(unseatedUnits)}
              </span>
            }
            collapsed={!searching && collapsedIds.has(UNSEATED_SECTION_ID)}
            drop={{ type: "unseated", area: "list" }}
            dropId="list-unseated"
            isDropTarget={dropTarget?.type === "unseated"}
            onToggle={() => onToggleSection(UNSEATED_SECTION_ID)}
            subtitle={
              unseatedUnits.length === 0
                ? anyoneInBuckets
                  ? "Everyone else has a table or bucket"
                  : "Everyone has a table"
                : `${unseatedUnits.length} ${unseatedUnits.length === 1 ? "party" : "parties"}${
                    unseatedUnconfirmed ? ` · ${unseatedUnconfirmed} unconfirmed` : ""
                  }`
            }
            title="Not seated"
          >
            {visibleUnseated.length === 0 ? (
              <p className="px-1 py-2 text-sm text-[#8f5070]">
                {draggingUnitId !== null
                  ? "Drop here to unseat."
                  : anyoneInBuckets
                    ? "Everyone else who might come has a table or a bucket."
                    : "Everyone who might come has a table."}
              </p>
            ) : (
              STATUS_GROUPS.map((group) => {
                const groupParties = visibleUnseated.filter((party) => party.status === group.status);

                if (groupParties.length === 0) {
                  return null;
                }

                return (
                  <div key={group.status} className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
                    <p className="flex items-center gap-1.5 px-1 pt-1 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[#8f5070]">
                      <PartyStatusIcon size={13} status={group.status} />
                      {group.title}
                      <span className="tabular-nums">· {peopleCount(groupParties)}</span>
                    </p>
                    {groupParties.map((party) => (
                      <ListPartyRow
                        key={party.id}
                        isDragging={draggingUnitId === party.id}
                        isMatch={searching}
                        onOpenUnit={onOpenUnit}
                        party={party}
                        seatNumbers={undefined}
                      />
                    ))}
                  </div>
                );
              })
            )}
          </SidebarSection>
        ) : null}

        {visibleBuckets.map((summary) => {
          const { bucket } = summary;
          const members = searching ? summary.units.filter((unit) => matchingUnitIds.has(unit.id)) : summary.units;

          return (
            <SidebarSection
              key={bucket.id}
              actions={
                <>
                  <button
                    type="button"
                    aria-label={`Show ${bucketTitle(bucket)} on the floor plan`}
                    className="grid size-8 place-items-center rounded-full text-[#a04670] transition hover:bg-[#ffe0ec] hover:text-[#7a1239]"
                    onClick={() => onLocateTable(bucket.id)}
                    title="Show on floor plan"
                  >
                    <LocateFixed size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Edit ${bucketTitle(bucket)}`}
                    className="grid size-8 place-items-center rounded-full text-[#a04670] transition hover:bg-[#ffe0ec] hover:text-[#7a1239]"
                    onClick={() => onOpenBucket(bucket.id)}
                    title="Rename or delete"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                </>
              }
              badge={
                <span className="rounded-full border border-dashed border-[#a04670] bg-white px-2 text-xs font-bold leading-6 tabular-nums text-[#7a1239]">
                  {summary.count}
                </span>
              }
              collapsed={!searching && collapsedIds.has(bucket.id)}
              drop={{ type: "bucket", bucketId: bucket.id, area: "list" }}
              dropId={`list-bucket-${bucket.id}`}
              icon={<Inbox aria-hidden="true" className="shrink-0 text-[#a04670]" size={15} />}
              isDropTarget={dropTarget?.type === "bucket" && dropTarget.bucketId === bucket.id}
              muted={!bucket.name}
              onHover={(hovering) => onHoverTable(hovering ? bucket.id : null)}
              onToggle={() => onToggleSection(bucket.id)}
              subtitle={`Bucket · not seated · ${summary.units.length} ${summary.units.length === 1 ? "party" : "parties"}`}
              title={bucketTitle(bucket)}
            >
              {members.length === 0 ? (
                <p className="px-1 py-2 text-sm text-[#8f5070]">
                  {draggingUnitId !== null ? "Drop here to hold them in this bucket." : "Drag people here to group them."}
                </p>
              ) : (
                members.map((unit) => (
                  <ListPartyRow
                    key={unit.id}
                    isDragging={draggingUnitId === unit.id}
                    isMatch={false}
                    onOpenUnit={onOpenUnit}
                    party={unit}
                    seatNumbers={undefined}
                  />
                ))
              )}
            </SidebarSection>
          );
        })}

        {visibleSummaries.map((summary) => {
          const { table } = summary;
          const previewCount = previewCounts.get(table.id);
          const badgeSummary =
            previewCount === undefined
              ? summary
              : { ...summary, count: previewCount, style: fullnessStyle(previewCount, table.capacity) };
          const parties = searching
            ? summary.units.filter((party) => matchingUnitIds.has(party.id))
            : summary.units;

          return (
            <SidebarSection
              key={table.id}
              actions={
                <>
                  <button
                    type="button"
                    aria-label={`Show ${tableTitle(table)} on the floor plan`}
                    className="grid size-8 place-items-center rounded-full text-[#a04670] transition hover:bg-[#ffe0ec] hover:text-[#7a1239]"
                    onClick={() => onLocateTable(table.id)}
                    title="Show on floor plan"
                  >
                    <LocateFixed size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Edit ${tableTitle(table)}`}
                    className="grid size-8 place-items-center rounded-full text-[#a04670] transition hover:bg-[#ffe0ec] hover:text-[#7a1239]"
                    onClick={() => onOpenTable(table.id)}
                    title="Number, name, seats"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                </>
              }
              badge={<FullnessBadge className="text-xs" summary={badgeSummary} />}
              collapsed={!searching && collapsedIds.has(table.id)}
              drop={{ type: "table", tableId: table.id, area: "list", shape: "rect" }}
              dropId={`list-table-${table.id}`}
              icon={table.kind === "sweetheart" ? <Heart aria-hidden="true" className="shrink-0 fill-[#be185d] text-[#be185d]" size={14} /> : null}
              isDropTarget={dropTarget?.type === "table" && dropTarget.tableId === table.id}
              muted={!table.number && !table.name}
              onHover={(hovering) => onHoverTable(hovering ? table.id : null)}
              onToggle={() => onToggleSection(table.id)}
              subtitle={
                [
                  table.number && table.name ? table.name : null,
                  summary.style.label,
                  summary.unconfirmed ? `${summary.unconfirmed} unconfirmed` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              }
              title={tableTitle(table)}
            >
              {parties.length === 0 ? (
                <p className="px-1 py-2 text-sm text-[#8f5070]">
                  {draggingUnitId !== null ? "Drop here to seat at this table." : "Drag parties here."}
                </p>
              ) : (
                parties.map((party) => (
                  <ListPartyRow
                    key={party.id}
                    isDragging={draggingUnitId === party.id}
                    isMatch={false}
                    onOpenUnit={onOpenUnit}
                    party={party}
                    seatNumbers={seatNumbersByUnit.get(party.id)}
                  />
                ))
              )}
            </SidebarSection>
          );
        })}
      </div>
    </aside>
  );
}

function SidebarSection({
  actions,
  badge,
  children,
  collapsed,
  drop,
  dropId,
  icon,
  isDropTarget,
  muted = false,
  onHover,
  onToggle,
  subtitle,
  title,
}: {
  actions?: ReactNode;
  badge: ReactNode;
  children: ReactNode;
  collapsed: boolean;
  drop: DropData;
  dropId: string;
  icon?: ReactNode;
  isDropTarget: boolean;
  muted?: boolean;
  onHover?: (hovering: boolean) => void;
  onToggle: () => void;
  subtitle: string;
  title: string;
}) {
  const { setNodeRef } = useDroppable({ id: dropId, data: drop });

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "border-b border-[#f3cddb] transition-colors",
        isDropTarget ? "bg-[#ffd8e8]" : "bg-[#fff8fb]",
      )}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
    >
      <div className="sticky top-0 z-10 flex items-center gap-1 bg-inherit pl-1 pr-2">
        <button
          type="button"
          aria-expanded={!collapsed}
          className="flex min-h-12 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-[#ffeaf2]"
          onClick={onToggle}
        >
          <ChevronDown
            aria-hidden="true"
            className={clsx("shrink-0 text-[#a04670] transition-transform", collapsed && "-rotate-90")}
            size={17}
          />
          {icon}
          <span className="min-w-0 flex-1">
            <span
              className={clsx(
                "block truncate text-[1.05rem] font-semibold leading-tight",
                muted ? "italic text-[#a07088]" : "text-[#4a1027]",
              )}
            >
              {title}
            </span>
            {subtitle ? (
              <span className="block truncate text-xs leading-tight text-[#8f5070]">{subtitle}</span>
            ) : null}
          </span>
          {badge}
        </button>
        {actions}
      </div>
      {collapsed ? null : <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5 px-3 pb-3">{children}</div>}
    </section>
  );
}

function partySubtitle(party: SeatingUnit, seatNumbers: number[] | undefined) {
  const seatText = seatNumbers?.length
    ? `${seatNumbers.length === 1 ? "Seat" : "Seats"} ${seatNumbers.join(", ")}`
    : null;

  if (party.position !== null) {
    if (party.status === "no") {
      return `Not coming · from ${party.party.name} · tap to remove`;
    }

    return [seatText, `${isPartyUnconfirmed(party) ? `${partyStatusLabel(party.status)} · ` : ""}from ${party.party.name}`]
      .filter(Boolean)
      .join(" · ");
  }

  if (party.status === "no") {
    return "Declined · tap to remove from this table";
  }

  if (isPartyUnconfirmed(party)) {
    return [`${partyStatusLabel(party.status)} · up to ${party.guestCount}`, seatText].filter(Boolean).join(" · ");
  }

  const names = party.attendees.map((attendee) => attendee.name).filter(Boolean).join(", ");
  return [seatText, names].filter(Boolean).join(" · ");
}

const ListPartyRow = memo(function ListPartyRow({
  isDragging,
  isMatch,
  onOpenUnit,
  party,
  seatNumbers,
}: {
  isDragging: boolean;
  isMatch: boolean;
  onOpenUnit: (unitId: string) => void;
  party: SeatingUnit;
  seatNumbers: number[] | undefined;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `party-list-${party.id}`,
    data: { type: "party", unitId: party.id } satisfies PartyDragData,
  });
  const subtitle = partySubtitle(party, seatNumbers);
  const unconfirmed = isPartyUnconfirmed(party);

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`${partyAriaLabel(party)}. Drag to a table, or tap to choose one.`}
      className={clsx(
        "seating-chip flex min-h-11 w-full cursor-grab items-center gap-2 rounded-xl border-[1.5px] px-2.5 py-1.5 text-left shadow-[0_1px_0_rgba(74,16,39,0.06)] transition hover:-translate-y-px hover:shadow-[0_6px_14px_-10px_rgba(74,16,39,0.6)]",
        partyCardClasses(party.status),
        isDragging && "opacity-35",
        isMatch && "ring-2 ring-[#ec4899]/60",
      )}
      onClick={() => onOpenUnit(party.id)}
    >
      <PartyStatusIcon size={17} status={party.status} />
      <span className="min-w-0 flex-1">
        <span
          className={clsx(
            "block truncate text-base font-semibold leading-tight",
            unconfirmed && "italic",
            party.status === "no" && "line-through",
          )}
        >
          {party.name}
        </span>
        {subtitle ? <span className="block truncate text-xs leading-tight opacity-80">{subtitle}</span> : null}
      </span>
      <PartySeatsBadge className="text-sm" party={party} />
    </button>
  );
});
