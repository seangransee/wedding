"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type Collision,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { getEventCoordinates } from "@dnd-kit/utilities";
import clsx from "clsx";
import {
  ArrowLeft,
  CloudCheck,
  Inbox,
  Download,
  LayoutGrid,
  List,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clampBucketPosition,
  clampTableCenter,
  compareSeatingTables,
  createSeatingId,
  currentSeats,
  compareUnitsAtTable,
  estimatedBucketHeight,
  findOpenBucketSpot,
  findOpenTableSpot,
  fullnessStyle,
  isPartyUnconfirmed,
  makeSeatingCsv,
  minimumRoomSize,
  partySeats,
  personKey,
  ROUND_TABLE_CAPACITY,
  searchTokens,
  seatingUnits,
  bucketTitle,
  tableFullTitle,
  unitMatchesSearch,
  type SeatingBucket,
  type SeatingChartData,
  type SeatingRoom,
  type SeatingSeat,
  type SeatingTable,
  type SeatingUnit,
} from "@/lib/seating";
import {
  addSeatingBucket,
  addSeatingTable,
  deleteSeatingTable,
  labelSeatingTable,
  loadSeatingChart,
  moveSeatingBucket,
  moveSeatingTable,
  resizeSeatingRoom,
  saveTableSeats,
  seatParty,
  seatPerson,
  splitParty,
  type SeatingActionResult,
} from "./actions";
import { BucketDialog, PartyDialog, TableDialog } from "./seating-dialogs";
import { bubbleDropPosition, FloorPlan, type FloorPlanHandle } from "./seating-floor-plan";
import { SeatingSidebar, UNSEATED_SECTION_ID } from "./seating-sidebar";
import {
  isBoolean,
  isStringArray,
  partyCardClasses,
  PartySeatsBadge,
  PartyStatusIcon,
  useStoredState,
  type BucketSummary,
  type DragData,
  type DropData,
  type TableSummary,
} from "./seating-ui";

type SaveOperation = {
  /** Consecutive waiting saves with the same key collapse into the latest one. */
  key: string;
  run: () => Promise<SeatingActionResult>;
};

type SaveState = { status: "saved" | "saving" | "error"; message: string };

type DialogState =
  | { type: "party"; unitId: string }
  | { type: "table"; tableId: string; focusLabel: boolean }
  | { type: "bucket"; bucketId: string; focusName: boolean }
  | null;

type MobileView = "list" | "plan";

const STATUS_RANK = { yes: 0, deciding: 1, none: 2, no: 3 } as const;
/** Collision priority (lower wins): buckets draw above tables, then the Not seated list, then the floor. */
const DROP_PRIORITY = { bucket: 0, table: 1, unseated: 2, room: 3 } as const;
const REFRESH_INTERVAL_MS = 30_000;
const STALE_INITIAL_DATA_MS = 15_000;

function isMobileView(value: unknown): value is MobileView {
  return value === "list" || value === "plan";
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 767px)").matches;
}

/**
 * Hit-tests droppables against the live pointer position. Tables beat the
 * Not seated section, which beats the empty floor. Droppables scrolled out of
 * their panel (data-seating-clip) don't count, and round tables only count
 * inside their circle.
 */
const seatingCollisionDetection: CollisionDetection = ({ droppableContainers, pointerCoordinates }) => {
  if (!pointerCoordinates) {
    return [];
  }

  const { x, y } = pointerCoordinates;
  const clipRects = new Map<Element, DOMRect>();
  const hits: Collision[] = [];

  for (const container of droppableContainers) {
    const node = container.node.current;
    const data = container.data.current as DropData | undefined;

    if (!node || !data || container.disabled) {
      continue;
    }

    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      continue;
    }

    const clip = node.closest("[data-seating-clip]");
    if (clip) {
      let clipRect = clipRects.get(clip);
      if (!clipRect) {
        clipRect = clip.getBoundingClientRect();
        clipRects.set(clip, clipRect);
      }
      if (x < clipRect.left || x > clipRect.right || y < clipRect.top || y > clipRect.bottom) {
        continue;
      }
    }

    if (data.type === "table" && data.shape === "round") {
      const radius = rect.width / 2;
      const dx = x - (rect.left + radius);
      const dy = y - (rect.top + rect.height / 2);
      if (dx * dx + dy * dy > (radius + 4) * (radius + 4)) {
        continue;
      }
    }

    const priority = DROP_PRIORITY[data.type];
    hits.push({ id: container.id, data: { droppableContainer: container, value: priority } });
  }

  return hits.sort((a, b) => Number(a.data?.value) - Number(b.data?.value));
};

function effectiveRoomSize(room: SeatingRoom, tables: readonly SeatingTable[]) {
  const minimum = minimumRoomSize(tables);
  return { width: Math.max(room.width, minimum.width), height: Math.max(room.height, minimum.height) };
}

export function SeatingChartClient({
  initialData,
  loadedAt,
}: {
  initialData: SeatingChartData;
  loadedAt: number;
}) {
  const [room, setRoom] = useState(initialData.room);
  const [tables, setTables] = useState(initialData.tables);
  const [parties, setParties] = useState(initialData.parties);
  const [seats, setSeats] = useState(initialData.seats);
  const [buckets, setBuckets] = useState(initialData.buckets);
  const stateRef = useRef({ room, tables, parties, seats, buckets });
  stateRef.current = { room, tables, parties, seats, buckets };

  const [saveState, setSaveState] = useState<SaveState>({ status: "saved", message: "All changes saved" });
  const queueRef = useRef<SaveOperation[]>([]);
  const savingRef = useRef(false);
  /** Bumped on every local edit so a slower server refresh can't overwrite it. */
  const editVersionRef = useRef(0);

  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const [overDrop, setOverDrop] = useState<DropData | null>(null);
  const draggingRef = useRef(false);
  const zoomRef = useRef(1);
  const planRef = useRef<FloorPlanHandle>(null);

  const [dialog, setDialog] = useState<DialogState>(null);
  const [query, setQuery] = useState("");
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [flashTableId, setFlashTableId] = useState<string | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const [collapsedList, setCollapsedList] = useStoredState<string[]>("seating-collapsed-sections", [], isStringArray);
  const [sidebarOpen, setSidebarOpen] = useStoredState("seating-sidebar-open", true, isBoolean);
  const [mobileView, setMobileView] = useStoredState<MobileView>("seating-mobile-view", "list", isMobileView);
  const collapsedIds = useMemo(() => new Set(collapsedList), [collapsedList]);

  // ---------- Autosave queue ----------

  const pumpQueue = useCallback(async () => {
    if (savingRef.current) {
      return;
    }

    savingRef.current = true;
    setSaveState({ status: "saving", message: "Saving…" });

    while (queueRef.current.length > 0) {
      const operation = queueRef.current[0];
      let result: SeatingActionResult;

      try {
        result = await operation.run();
      } catch (error) {
        result = {
          ok: false,
          message:
            error instanceof Error && /admin login/i.test(error.message)
              ? "Your admin login expired. Reload to sign in again."
              : "Couldn't reach the server.",
        };
      }

      if (!result.ok) {
        savingRef.current = false;
        setSaveState({ status: "error", message: result.message });
        return;
      }

      queueRef.current.shift();
    }

    savingRef.current = false;
    setSaveState({ status: "saved", message: "All changes saved" });
  }, []);

  const enqueueSave = useCallback(
    (operation: SaveOperation) => {
      editVersionRef.current += 1;
      const queue = queueRef.current;
      const lastIndex = queue.length - 1;
      const lastIsWaiting = lastIndex > 0 || (lastIndex === 0 && !savingRef.current);

      if (lastIsWaiting && queue[lastIndex].key === operation.key) {
        queue[lastIndex] = operation;
      } else {
        queue.push(operation);
      }

      void pumpQueue();
    },
    [pumpQueue],
  );

  useEffect(() => {
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      if (queueRef.current.length > 0) {
        event.preventDefault();
      }
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, []);

  // ---------- Pull in changes from other devices and new RSVPs ----------

  const refreshFromServer = useCallback(async () => {
    if (queueRef.current.length > 0 || savingRef.current || draggingRef.current) {
      return;
    }

    const versionAtStart = editVersionRef.current;

    try {
      const data = await loadSeatingChart();

      if (
        versionAtStart !== editVersionRef.current ||
        queueRef.current.length > 0 ||
        draggingRef.current
      ) {
        return;
      }

      setRoom(data.room);
      setTables(data.tables);
      setParties(data.parties);
      setSeats(data.seats);
      setBuckets(data.buckets);
    } catch {
      // Offline or logged out; the next refresh or save will surface it.
    }
  }, []);

  useEffect(() => {
    if (Math.abs(Date.now() - loadedAt) > STALE_INITIAL_DATA_MS) {
      void refreshFromServer();
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void refreshFromServer();
      }
    }

    const interval = window.setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [loadedAt, refreshFromServer]);

  // ---------- Derived data ----------

  const sortedTables = useMemo(() => [...tables].sort(compareSeatingTables), [tables]);
  const tableIds = useMemo(() => new Set(tables.map((table) => table.id)), [tables]);
  const validSeats = useMemo(() => currentSeats(seats, parties, tables), [seats, parties, tables]);
  // Whole parties plus one unit per person for split parties.
  const units = useMemo(() => seatingUnits(parties), [parties]);
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);

  const { seatNumbersByUnit, seatedNumbersByTable, seatsByTable } = useMemo(() => {
    const splitPartyIds = new Set(parties.filter((party) => party.split).map((party) => party.id));
    const byUnit = new Map<string, number[]>();
    const numbersByTable = new Map<string, Set<number>>();
    const byTable = new Map<string, SeatingSeat[]>();

    for (const seat of validSeats) {
      const unitId = splitPartyIds.has(seat.partyId) ? personKey(seat.partyId, seat.position) : String(seat.partyId);
      byUnit.set(unitId, [...(byUnit.get(unitId) ?? []), seat.seatNumber].sort((a, b) => a - b));
      numbersByTable.set(seat.tableId, (numbersByTable.get(seat.tableId) ?? new Set()).add(seat.seatNumber));
      byTable.set(seat.tableId, [...(byTable.get(seat.tableId) ?? []), seat]);
    }

    return { seatNumbersByUnit: byUnit, seatedNumbersByTable: numbersByTable, seatsByTable: byTable };
  }, [parties, validSeats]);

  const summaries = useMemo<TableSummary[]>(() => {
    const unitsByTable = new Map<string, SeatingUnit[]>();

    for (const unit of units) {
      if (unit.tableId && tableIds.has(unit.tableId)) {
        unitsByTable.set(unit.tableId, [...(unitsByTable.get(unit.tableId) ?? []), unit]);
      }
    }

    return sortedTables.map((table) => {
      const tableUnits = (unitsByTable.get(table.id) ?? []).sort(compareUnitsAtTable);
      let count = 0;
      let unconfirmed = 0;

      for (const unit of tableUnits) {
        const unitCount = partySeats(unit);
        count += unitCount;
        if (isPartyUnconfirmed(unit)) {
          unconfirmed += unitCount;
        }
      }

      return { table, units: tableUnits, count, unconfirmed, style: fullnessStyle(count, table.capacity) };
    });
  }, [units, sortedTables, tableIds]);

  const summaryById = useMemo(() => new Map(summaries.map((summary) => [summary.table.id, summary])), [summaries]);

  const sortedBuckets = useMemo(
    () => [...buckets].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
    [buckets],
  );
  const bucketIds = useMemo(() => new Set(buckets.map((bucket) => bucket.id)), [buckets]);
  const bubbleIds = useMemo(
    () => new Set(buckets.filter((bucket) => bucket.bubble).map((bucket) => bucket.id)),
    [buckets],
  );

  // Confirmed first, then maybes, then no reply; guest-list order within each.
  // Includes people in buckets: they aren't seated either.
  const unseatedUnits = useMemo(
    () =>
      units
        .filter((unit) => partySeats(unit) > 0 && !(unit.tableId && tableIds.has(unit.tableId)))
        .sort(
          (a, b) =>
            STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
            a.sortOrder - b.sortOrder ||
            a.partyId - b.partyId ||
            (a.position ?? 0) - (b.position ?? 0),
        ),
    [units, tableIds],
  );
  // Not seated and not in a named bucket (people in bubbles are listed as plain Not seated).
  const looseUnits = useMemo(
    () =>
      unseatedUnits.filter(
        (unit) => !(unit.tableId && bucketIds.has(unit.tableId) && !bubbleIds.has(unit.tableId)),
      ),
    [bubbleIds, bucketIds, unseatedUnits],
  );
  // Every bucket and bubble drawn on the floor plan. A bubble with nobody left
  // in it is hidden right away (the server deletes it with the move that emptied it).
  const planBucketSummaries = useMemo<BucketSummary[]>(
    () =>
      sortedBuckets
        .map((bucket) => {
          const members = units
            .filter((unit) => unit.tableId === bucket.id && partySeats(unit) > 0)
            .sort(compareUnitsAtTable);
          return { bucket, units: members, count: members.reduce((total, unit) => total + partySeats(unit), 0) };
        })
        .filter((summary) => !summary.bucket.bubble || summary.units.length > 0),
    [sortedBuckets, units],
  );
  // Named buckets only: these get their own sidebar sections and dialog choices.
  const bucketSummaries = useMemo(
    () => planBucketSummaries.filter((summary) => !summary.bucket.bubble),
    [planBucketSummaries],
  );
  const bucketSummaryById = useMemo(
    () => new Map(bucketSummaries.map((summary) => [summary.bucket.id, summary])),
    [bucketSummaries],
  );

  const totals = useMemo(() => {
    let potential = 0;
    let unconfirmed = 0;
    let seated = 0;

    for (const unit of units) {
      const unitCount = partySeats(unit);
      potential += unitCount;
      if (isPartyUnconfirmed(unit)) {
        unconfirmed += unitCount;
      }
      if (unit.tableId && tableIds.has(unit.tableId)) {
        seated += unitCount;
      }
    }

    const roundTables = tables.filter((table) => table.kind === "round");
    const sweetheartSeats = tables
      .filter((table) => table.kind === "sweetheart")
      .reduce((total, table) => total + table.capacity, 0);
    const seatsAvailable = tables.reduce((total, table) => total + table.capacity, 0);
    const tablesNeeded = Math.max(0, Math.ceil((potential - sweetheartSeats) / ROUND_TABLE_CAPACITY));

    return {
      potential,
      unconfirmed,
      seated,
      notSeated: potential - seated,
      roundTableCount: roundTables.length,
      seatsAvailable,
      tablesNeeded,
    };
  }, [units, tableIds, tables]);

  const searchTokenList = useMemo(() => searchTokens(query), [query]);
  const matchingUnitIds = useMemo(
    () =>
      searchTokenList.length
        ? new Set(units.filter((unit) => unitMatchesSearch(unit, searchTokenList)).map((unit) => unit.id))
        : null,
    [units, searchTokenList],
  );

  const draggingUnit = activeDrag?.type === "party" ? unitById.get(activeDrag.unitId) ?? null : null;

  // While dragging a party, show what the source and target tables would hold.
  const previewCounts = useMemo(() => {
    const counts = new Map<string, number>();

    if (!draggingUnit || !overDrop || overDrop.type === "room") {
      return counts;
    }

    const sourceTableId = draggingUnit.tableId && tableIds.has(draggingUnit.tableId) ? draggingUnit.tableId : null;
    const targetTableId = overDrop.type === "table" ? overDrop.tableId : null;

    if (sourceTableId === targetTableId) {
      return counts;
    }

    const partyCount = partySeats(draggingUnit);
    if (targetTableId) {
      counts.set(targetTableId, (summaryById.get(targetTableId)?.count ?? 0) + partyCount);
    }
    if (sourceTableId) {
      counts.set(sourceTableId, (summaryById.get(sourceTableId)?.count ?? 0) - partyCount);
    }

    return counts;
  }, [draggingUnit, overDrop, summaryById, tableIds]);

  // ---------- Edits (optimistic, then autosaved) ----------

  const flashTable = useCallback((tableId: string) => {
    setFlashTableId(tableId);
    if (flashTimeoutRef.current !== null) {
      window.clearTimeout(flashTimeoutRef.current);
    }
    flashTimeoutRef.current = window.setTimeout(() => setFlashTableId(null), 1400);
  }, []);

  /** Seats a whole party at a table (joining it back together if it was split), or unseats it. */
  const assignParty = useCallback(
    (partyId: number, tableId: string | null) => {
      const party = stateRef.current.parties.find((candidate) => candidate.id === partyId);

      if (!party || (!party.split && party.tableId === tableId)) {
        return;
      }

      setParties((current) =>
        current.map((candidate) =>
          candidate.id === partyId
            ? { ...candidate, tableId, assignedAt: tableId ? Date.now() : null, split: false, people: [] }
            : candidate,
        ),
      );
      // Exact seats at any other table belong to the old table.
      setSeats((current) => current.filter((seat) => seat.partyId !== partyId || (tableId !== null && seat.tableId === tableId)));
      enqueueSave({ key: `party:${partyId}`, run: () => seatParty(partyId, tableId) });

      if (tableId) {
        flashTable(tableId);
      }
    },
    [enqueueSave, flashTable],
  );

  /** Seats (or unseats) one person from a split party. */
  const assignPerson = useCallback(
    (partyId: number, position: number, tableId: string | null) => {
      const party = stateRef.current.parties.find((candidate) => candidate.id === partyId);
      const currentTableId = party?.people.find((person) => person.position === position)?.tableId ?? null;

      if (!party?.split || currentTableId === tableId) {
        return;
      }

      setParties((current) =>
        current.map((candidate) =>
          candidate.id === partyId
            ? {
                ...candidate,
                people: [
                  ...candidate.people.filter((person) => person.position !== position),
                  ...(tableId ? [{ position, tableId, assignedAt: Date.now() }] : []),
                ].sort((a, b) => a.position - b.position),
              }
            : candidate,
        ),
      );
      setSeats((current) =>
        current.filter((seat) => seat.partyId !== partyId || seat.position !== position || seat.tableId === tableId),
      );
      enqueueSave({ key: `person:${partyId}:${position}`, run: () => seatPerson(partyId, position, tableId) });

      if (tableId) {
        flashTable(tableId);
      }
    },
    [enqueueSave, flashTable],
  );

  const assignUnit = useCallback(
    (unitId: string, tableId: string | null) => {
      const unit = seatingUnits(stateRef.current.parties).find((candidate) => candidate.id === unitId);

      if (!unit) {
        return;
      }

      if (unit.position === null) {
        assignParty(unit.partyId, tableId);
      } else {
        assignPerson(unit.partyId, unit.position, tableId);
      }
    },
    [assignParty, assignPerson],
  );

  /** Lets each person in a party sit at their own table; everyone starts where the party was. */
  const splitPartyUp = useCallback(
    (partyId: number) => {
      const party = stateRef.current.parties.find((candidate) => candidate.id === partyId);

      if (!party || party.split) {
        return;
      }

      const peopleCount = Math.min(10, partySeats(party));
      const { tableId, assignedAt } = party;

      setParties((current) =>
        current.map((candidate) =>
          candidate.id === partyId
            ? {
                ...candidate,
                split: true,
                tableId: null,
                assignedAt: null,
                people: tableId
                  ? Array.from({ length: peopleCount }, (_, index) => ({
                      position: index + 1,
                      tableId,
                      assignedAt: assignedAt ?? Date.now(),
                    }))
                  : [],
              }
            : candidate,
        ),
      );
      enqueueSave({ key: `split:${partyId}`, run: () => splitParty(partyId, peopleCount) });
    },
    [enqueueSave],
  );

  const moveTable = useCallback(
    (tableId: string, x: number, y: number) => {
      setTables((current) => current.map((table) => (table.id === tableId ? { ...table, x, y } : table)));
      enqueueSave({ key: `move:${tableId}`, run: () => moveSeatingTable(tableId, x, y) });
    },
    [enqueueSave],
  );

  const resizeRoom = useCallback(
    (next: SeatingRoom) => {
      setRoom(next);
      enqueueSave({ key: "room", run: () => resizeSeatingRoom(next.width, next.height) });
    },
    [enqueueSave],
  );

  const addTable = useCallback(() => {
    const { room: currentRoom, tables: currentTables } = stateRef.current;
    const spot = findOpenTableSpot(effectiveRoomSize(currentRoom, currentTables), currentTables);
    const table: SeatingTable = {
      id: createSeatingId(),
      kind: "round",
      number: "",
      name: "",
      capacity: ROUND_TABLE_CAPACITY,
      x: spot.x,
      y: spot.y,
      createdAt: Date.now(),
    };

    if (spot.room.width !== currentRoom.width || spot.room.height !== currentRoom.height) {
      resizeRoom(spot.room);
    }

    setTables((current) => [...current, table]);
    enqueueSave({
      key: `add:${table.id}`,
      run: () => addSeatingTable({ id: table.id, number: "", name: "", x: table.x, y: table.y }),
    });
    setDialog({ type: "table", tableId: table.id, focusLabel: true });
    flashTable(table.id);
    window.requestAnimationFrame(() => planRef.current?.revealTable(table.id));
  }, [enqueueSave, flashTable, resizeRoom]);

  const labelTable = useCallback(
    (tableId: string, number: string, name: string) => {
      setTables((current) => current.map((table) => (table.id === tableId ? { ...table, number, name } : table)));
      enqueueSave({ key: `label:${tableId}`, run: () => labelSeatingTable(tableId, number, name) });
    },
    [enqueueSave],
  );

  const addBucket = useCallback(() => {
    const { room: currentRoom, tables: currentTables, buckets: currentBuckets, parties: currentParties } = stateRef.current;
    const memberCounts = new Map<string, number>();
    for (const unit of seatingUnits(currentParties)) {
      if (unit.tableId) {
        memberCounts.set(unit.tableId, (memberCounts.get(unit.tableId) ?? 0) + 1);
      }
    }
    const spot = findOpenBucketSpot(effectiveRoomSize(currentRoom, currentTables), currentBuckets, (index) =>
      estimatedBucketHeight(memberCounts.get(currentBuckets[index].id) ?? 0),
    );
    const bucket: SeatingBucket = {
      id: createSeatingId(),
      name: "",
      x: spot.x,
      y: spot.y,
      bubble: false,
      createdAt: Date.now(),
    };

    setBuckets((current) => [...current, bucket]);
    enqueueSave({
      key: `add:${bucket.id}`,
      run: () => addSeatingBucket({ id: bucket.id, name: "", x: bucket.x, y: bucket.y }),
    });
    setDialog({ type: "bucket", bucketId: bucket.id, focusName: true });
    flashTable(bucket.id);
    window.requestAnimationFrame(() => planRef.current?.revealTable(bucket.id));
  }, [enqueueSave, flashTable]);

  const moveBucket = useCallback(
    (bucketId: string, x: number, y: number) => {
      setBuckets((current) => current.map((bucket) => (bucket.id === bucketId ? { ...bucket, x, y } : bucket)));
      enqueueSave({ key: `move:${bucketId}`, run: () => moveSeatingBucket(bucketId, x, y) });
    },
    [enqueueSave],
  );

  /**
   * Puts someone in their own little bubble on the floor at a room point, so
   * anywhere can be a staging area. If they're already alone in a bubble, that
   * bubble just moves there.
   */
  const dropInBubble = useCallback(
    (unitId: string, point: { x: number; y: number }) => {
      const { parties: currentParties, buckets: currentBuckets } = stateRef.current;
      const unit = seatingUnits(currentParties).find((candidate) => candidate.id === unitId);

      if (!unit || partySeats(unit) === 0) {
        return;
      }

      const position = bubbleDropPosition(point, zoomRef.current || 1);
      const currentBubble = currentBuckets.find((bucket) => bucket.bubble && bucket.id === unit.tableId);

      if (currentBubble) {
        const othersInBubble = currentParties.some((party) =>
          party.split
            ? party.people.some(
                (person) =>
                  person.tableId === currentBubble.id &&
                  !(party.id === unit.partyId && person.position === unit.position),
              )
            : party.tableId === currentBubble.id && party.id !== unit.partyId,
        );

        if (!othersInBubble) {
          moveBucket(currentBubble.id, position.x, position.y);
          return;
        }
      }

      const bubble: SeatingBucket = { id: createSeatingId(), name: "", ...position, bubble: true, createdAt: Date.now() };
      setBuckets((current) => [...current, bubble]);
      enqueueSave({
        key: `add:${bubble.id}`,
        run: () => addSeatingBucket({ id: bubble.id, name: "", x: bubble.x, y: bubble.y, bubble: true }),
      });
      assignUnit(unitId, bubble.id);
    },
    [assignUnit, enqueueSave, moveBucket],
  );

  const renameBucket = useCallback(
    (bucketId: string, name: string) => {
      setBuckets((current) => current.map((bucket) => (bucket.id === bucketId ? { ...bucket, name } : bucket)));
      enqueueSave({ key: `label:${bucketId}`, run: () => labelSeatingTable(bucketId, "", name) });
    },
    [enqueueSave],
  );

  const deleteBucket = useCallback(
    (bucketId: string) => {
      setBuckets((current) => current.filter((bucket) => bucket.id !== bucketId));
      setParties((current) =>
        current.map((party) =>
          party.tableId === bucketId
            ? { ...party, tableId: null, assignedAt: null }
            : party.people.some((person) => person.tableId === bucketId)
              ? { ...party, people: party.people.filter((person) => person.tableId !== bucketId) }
              : party,
        ),
      );
      enqueueSave({ key: `delete:${bucketId}`, run: () => deleteSeatingTable(bucketId) });
      setDialog(null);
    },
    [enqueueSave],
  );

  const deleteTable = useCallback(
    (tableId: string) => {
      setTables((current) => current.filter((table) => table.id !== tableId));
      setParties((current) =>
        current.map((party) =>
          party.tableId === tableId
            ? { ...party, tableId: null, assignedAt: null }
            : party.people.some((person) => person.tableId === tableId)
              ? { ...party, people: party.people.filter((person) => person.tableId !== tableId) }
              : party,
        ),
      );
      setSeats((current) => current.filter((seat) => seat.tableId !== tableId));
      enqueueSave({ key: `delete:${tableId}`, run: () => deleteSeatingTable(tableId) });
      setDialog(null);
    },
    [enqueueSave],
  );

  const setTableSeats = useCallback(
    (tableId: string, nextSeats: SeatingSeat[]) => {
      setSeats((current) => [...current.filter((seat) => seat.tableId !== tableId), ...nextSeats]);
      enqueueSave({
        key: `seats:${tableId}`,
        run: () =>
          saveTableSeats(
            tableId,
            nextSeats.map((seat) => ({ seatNumber: seat.seatNumber, partyId: seat.partyId, position: seat.position })),
          ),
      });
    },
    [enqueueSave],
  );

  // ---------- UI handlers ----------

  const openUnit = useCallback((unitId: string) => setDialog({ type: "party", unitId }), []);
  const openTable = useCallback(
    (tableId: string) => setDialog({ type: "table", tableId, focusLabel: false }),
    [],
  );
  const openBucket = useCallback(
    (bucketId: string) => setDialog({ type: "bucket", bucketId, focusName: false }),
    [],
  );

  const toggleSection = useCallback(
    (sectionId: string) => {
      setCollapsedList((current) =>
        current.includes(sectionId) ? current.filter((id) => id !== sectionId) : [...current, sectionId],
      );
    },
    [setCollapsedList],
  );

  const setAllCollapsed = useCallback(
    (collapsed: boolean) => {
      setCollapsedList(
        collapsed
          ? [
              UNSEATED_SECTION_ID,
              ...stateRef.current.buckets.map((bucket) => bucket.id),
              ...stateRef.current.tables.map((table) => table.id),
            ]
          : [],
      );
    },
    [setCollapsedList],
  );

  const locateTable = useCallback(
    (tableId: string) => {
      if (isMobileLayout()) {
        setMobileView("plan");
      } else {
        setSidebarOpen(true);
      }
      flashTable(tableId);
      // Wait for the plan to be laid out if it was hidden.
      window.setTimeout(() => planRef.current?.revealTable(tableId), 60);
    },
    [flashTable, setMobileView, setSidebarOpen],
  );

  function exportCsv() {
    const csv = makeSeatingCsv({ room, tables, buckets, parties, seats });
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `sexi-wedding-seating-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    // Some browsers (notably Safari) read the blob after click() returns.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  // ---------- Drag and drop ----------

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Long-press to drag on touch screens so a normal swipe still scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    draggingRef.current = true;
    setActiveDrag((event.active.data.current as DragData | undefined) ?? null);
    setOverDrop(null);
    if ("vibrate" in navigator) {
      navigator.vibrate?.(8);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    setOverDrop((event.over?.data.current as DropData | undefined) ?? null);
  }

  function finishDrag() {
    draggingRef.current = false;
    setActiveDrag(null);
    setOverDrop(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const drag = event.active.data.current as DragData | undefined;
    const over = event.over?.data.current as DropData | undefined;

    if (drag?.type === "party") {
      if (over?.type === "table") {
        assignUnit(drag.unitId, over.tableId);
      } else if (over?.type === "bucket") {
        assignUnit(drag.unitId, over.bucketId);
      } else if (over?.type === "unseated") {
        assignUnit(drag.unitId, null);
      } else if (over?.type === "room") {
        // Empty floor, inside or outside the room: give them their own bubble there.
        const start = getEventCoordinates(event.activatorEvent);
        const point = start
          ? planRef.current?.clientToRoom(start.x + event.delta.x, start.y + event.delta.y)
          : null;

        if (point) {
          dropInBubble(drag.unitId, point);
        }
      }
    } else if (drag?.type === "bucket") {
      const bucket = stateRef.current.buckets.find((candidate) => candidate.id === drag.bucketId);

      if (bucket && (event.delta.x !== 0 || event.delta.y !== 0)) {
        const zoom = zoomRef.current || 1;
        const next = clampBucketPosition(bucket.x + event.delta.x / zoom, bucket.y + event.delta.y / zoom);

        if (next.x !== bucket.x || next.y !== bucket.y) {
          moveBucket(bucket.id, next.x, next.y);
        }
      }
    } else if (drag?.type === "table") {
      const table = stateRef.current.tables.find((candidate) => candidate.id === drag.tableId);

      if (table && (event.delta.x !== 0 || event.delta.y !== 0)) {
        const zoom = zoomRef.current || 1;
        const next = clampTableCenter(
          table.kind,
          table.x + event.delta.x / zoom,
          table.y + event.delta.y / zoom,
          effectiveRoomSize(stateRef.current.room, stateRef.current.tables),
        );

        if (next.x !== table.x || next.y !== table.y) {
          moveTable(table.id, next.x, next.y);
        }
      }
    }

    finishDrag();
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      return `Picked up ${describeDrag(active.data.current as DragData | undefined)}.`;
    },
    onDragOver({ active, over }) {
      return over
        ? `${describeDrag(active.data.current as DragData | undefined)} is over ${describeDrop(over.data.current as DropData | undefined)}.`
        : undefined;
    },
    onDragEnd({ active, over }) {
      return over
        ? `Dropped ${describeDrag(active.data.current as DragData | undefined)} on ${describeDrop(over.data.current as DropData | undefined)}.`
        : `Dropped ${describeDrag(active.data.current as DragData | undefined)}.`;
    },
    onDragCancel({ active }) {
      return `Stopped dragging ${describeDrag(active.data.current as DragData | undefined)}.`;
    },
  };

  function describeDrag(drag: DragData | undefined) {
    if (drag?.type === "party") {
      return seatingUnits(stateRef.current.parties).find((unit) => unit.id === drag.unitId)?.name ?? "party";
    }
    if (drag?.type === "table") {
      const table = stateRef.current.tables.find((candidate) => candidate.id === drag.tableId);
      return table ? tableFullTitle(table) : "table";
    }
    if (drag?.type === "bucket") {
      const bucket = stateRef.current.buckets.find((candidate) => candidate.id === drag.bucketId);
      return bucket ? bucketTitle(bucket) : "bucket";
    }
    return "item";
  }

  function describeDrop(drop: DropData | undefined) {
    if (drop?.type === "table") {
      const table = stateRef.current.tables.find((candidate) => candidate.id === drop.tableId);
      return table ? tableFullTitle(table) : "a table";
    }
    if (drop?.type === "bucket") {
      const bucket = stateRef.current.buckets.find((candidate) => candidate.id === drop.bucketId);
      return bucket ? bucketTitle(bucket) : "a bucket";
    }
    return drop?.type === "unseated" ? "Not seated" : "the floor, in their own bubble";
  }

  const dropTableId = activeDrag?.type === "party" && overDrop?.type === "table" ? overDrop.tableId : null;
  const dropBucketId = activeDrag?.type === "party" && overDrop?.type === "bucket" ? overDrop.bucketId : null;
  const highlightedTableId = dropTableId ?? dropBucketId ?? hoveredTableId ?? flashTableId;

  // ---------- Dialog data ----------

  const dialogUnit = dialog?.type === "party" ? unitById.get(dialog.unitId) ?? null : null;
  const dialogTable = dialog?.type === "table" ? summaryById.get(dialog.tableId) ?? null : null;
  const dialogBucket = dialog?.type === "bucket" ? bucketSummaryById.get(dialog.bucketId) ?? null : null;

  return (
    <DndContext
      // A fixed id keeps dnd-kit's aria-describedby ids identical on the server and client.
      id="seating-chart"
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "Press Enter to open options. Drag with a mouse, or long-press on a touch screen.",
        },
      }}
      collisionDetection={seatingCollisionDetection}
      onDragCancel={finishDrag}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <main className="flex h-dvh flex-col overflow-hidden bg-[#f9d8e6] text-[#4a1027]">
        <header className="shrink-0 border-b border-[#df7fa3] bg-[#f4bfd2] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2 px-3 py-2">
            <Link
              href="/admin"
              aria-label="Back to RSVP admin"
              className="grid size-10 shrink-0 place-items-center rounded-full border border-[#df7fa3] bg-[#fff8fb] text-[#7a1239] transition hover:bg-[#ffe0ec]"
              title="Back to RSVP admin"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </Link>
            <div className="min-w-0">
              <p
                className="hidden text-lg leading-none text-[#be185d] sm:block"
                style={{ fontFamily: "var(--font-brand-script)", fontWeight: 400 }}
              >
                Sean + Lexi = Sexi
              </p>
              <h1 className="truncate text-xl font-semibold leading-tight text-[#7a1239]">Seating chart</h1>
            </div>

            <SeatingStats className="mx-2 hidden lg:flex" totals={totals} />

            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <SaveIndicator onRetry={() => void pumpQueue()} state={saveState} />
              <button
                type="button"
                aria-label="Export the seating chart as CSV"
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#7a1239] bg-[#fff8fb] px-3 text-xs font-bold uppercase tracking-[0.1em] text-[#7a1239] transition hover:bg-[#ffe0ec]"
                onClick={exportCsv}
                title="Export CSV: one row per guest with table, seat, RSVP, and meal"
              >
                <Download size={15} aria-hidden="true" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                type="button"
                aria-label={sidebarOpen ? "Hide the guest list" : "Show the guest list"}
                className="hidden size-10 place-items-center rounded-full border border-[#df7fa3] bg-[#fff8fb] text-[#7a1239] transition hover:bg-[#ffe0ec] md:grid"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                title={sidebarOpen ? "Hide guest list" : "Show guest list"}
              >
                {sidebarOpen ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1 rounded-full border border-[#7a1239] bg-[#fff8fb] px-3 text-xs font-bold uppercase tracking-[0.1em] text-[#7a1239] transition hover:bg-[#ffe0ec]"
                onClick={addBucket}
                aria-label="Add a bucket for people who aren't seated yet"
                title="Add a named bucket to hold people who aren't seated yet"
              >
                <Inbox size={15} aria-hidden="true" />
                <span className="hidden sm:inline">Bucket</span>
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1 rounded-full border border-[#7a1239] bg-[#9f1d52] px-3.5 text-xs font-bold uppercase tracking-[0.1em] text-white shadow-[0_8px_18px_-12px_rgba(74,16,39,0.9)] transition hover:bg-[#bd2867]"
                onClick={addTable}
                aria-label="Add a 12-person table"
                title="Add a 12-person table"
              >
                <Plus size={16} aria-hidden="true" />
                Table
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 pb-2 lg:hidden">
            <div className="flex shrink-0 rounded-full border border-[#df7fa3] bg-[#fff8fb] p-0.5 md:hidden" role="tablist">
              {(["list", "plan"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  aria-selected={mobileView === view}
                  className={clsx(
                    "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition",
                    mobileView === view ? "bg-[#9f1d52] text-white" : "text-[#7a1239]",
                  )}
                  onClick={() => setMobileView(view)}
                  role="tab"
                >
                  {view === "list" ? <List size={15} aria-hidden="true" /> : <LayoutGrid size={15} aria-hidden="true" />}
                  {view === "list" ? "List" : "Floor plan"}
                </button>
              ))}
            </div>
            <SeatingStats className="min-w-0 flex-1" compact totals={totals} />
          </div>

          {saveState.status === "error" ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-[#fca5a5] bg-[#fef2f2] px-3 py-2 text-sm text-[#991b1b]" role="alert">
              <TriangleAlert size={16} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0 flex-1 font-semibold">Not saved: {saveState.message}</span>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-full border border-[#dc2626] bg-white px-3 text-xs font-bold"
                onClick={() => void pumpQueue()}
              >
                <RotateCcw size={13} aria-hidden="true" /> Retry
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-full border border-[#dc2626] bg-white px-3 text-xs font-bold"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            </div>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          <SeatingSidebar
            className={clsx(
              "w-full border-[#df7fa3] md:w-[21rem] md:shrink-0 md:border-r lg:w-[23rem]",
              mobileView === "plan" && "max-md:hidden",
              !sidebarOpen && "md:hidden",
            )}
            collapsedIds={collapsedIds}
            bucketSummaries={bucketSummaries}
            draggingUnitId={draggingUnit?.id ?? null}
            dropTarget={activeDrag?.type === "party" ? overDrop : null}
            matchingUnitIds={matchingUnitIds}
            onHoverTable={setHoveredTableId}
            onLocateTable={locateTable}
            onOpenBucket={openBucket}
            onOpenUnit={openUnit}
            onOpenTable={openTable}
            onQueryChange={setQuery}
            onSetAllCollapsed={setAllCollapsed}
            onToggleSection={toggleSection}
            previewCounts={previewCounts}
            query={query}
            seatNumbersByUnit={seatNumbersByUnit}
            summaries={summaries}
            unseatedUnits={looseUnits}
          />
          <section
            aria-label="Floor plan"
            className={clsx("min-w-0 flex-1 flex-col", mobileView === "list" ? "hidden md:flex" : "flex")}
            data-seating-clip
          >
            <FloorPlan
              ref={planRef}
              bucketSummaries={planBucketSummaries}
              draggingBucketId={activeDrag?.type === "bucket" ? activeDrag.bucketId : null}
              draggingUnitId={draggingUnit?.id ?? null}
              draggingTableId={activeDrag?.type === "table" ? activeDrag.tableId : null}
              dropBucketId={dropBucketId}
              dropTableId={dropTableId}
              highlightedTableId={highlightedTableId}
              matchingUnitIds={matchingUnitIds}
              onOpenBucket={openBucket}
              onOpenUnit={openUnit}
              onOpenTable={openTable}
              onResizeRoom={resizeRoom}
              previewCounts={previewCounts}
              room={room}
              seatedNumbersByTable={seatedNumbersByTable}
              summaries={summaries}
              zoomRef={zoomRef}
            />
          </section>
        </div>
      </main>

      <DragOverlay dropAnimation={null} modifiers={draggingUnit ? [snapCenterToCursor] : undefined}>
        {draggingUnit ? <DraggedPartyChip unit={draggingUnit} /> : null}
      </DragOverlay>

      {dialogUnit ? (
        <PartyDialog
          key={`party-${dialogUnit.id}`}
          bubbleIds={bubbleIds}
          bucketSummaries={bucketSummaries}
          onOpenBucket={openBucket}
          onAssign={(tableId) => {
            assignUnit(dialogUnit.id, tableId);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
          onJoin={(tableId) => {
            assignParty(dialogUnit.partyId, tableId);
            setDialog({ type: "party", unitId: String(dialogUnit.partyId) });
          }}
          onOpenTable={openTable}
          onOpenUnit={openUnit}
          onSplit={() => {
            splitPartyUp(dialogUnit.partyId);
            setDialog({ type: "party", unitId: personKey(dialogUnit.partyId, 1) });
          }}
          seatNumbersByUnit={seatNumbersByUnit}
          siblings={units.filter((unit) => unit.partyId === dialogUnit.partyId)}
          summaries={summaries}
          summaryById={summaryById}
          unit={dialogUnit}
        />
      ) : null}

      {dialogBucket ? (
        <BucketDialog
          key={`bucket-${dialogBucket.bucket.id}`}
          autoFocusName={dialog?.type === "bucket" && dialog.focusName}
          onClose={() => setDialog(null)}
          onDelete={() => deleteBucket(dialogBucket.bucket.id)}
          onOpenUnit={openUnit}
          onRemoveUnit={(unitId) => assignUnit(unitId, null)}
          onRename={(name) => renameBucket(dialogBucket.bucket.id, name)}
          summary={dialogBucket}
        />
      ) : null}

      {dialog?.type === "table" && dialogTable ? (
        <TableDialog
          key={`table-${dialogTable.table.id}`}
          autoFocusLabel={dialog.focusLabel}
          duplicateNumber={(number) =>
            tables.some(
              (table) =>
                table.id !== dialogTable.table.id && table.number.trim().toLowerCase() === number.toLowerCase(),
            )
          }
          onAssignUnit={assignUnit}
          onClose={() => setDialog(null)}
          onDelete={() => deleteTable(dialogTable.table.id)}
          onLabel={(number, name) => labelTable(dialogTable.table.id, number, name)}
          onOpenUnit={openUnit}
          onSetSeats={(nextSeats) => setTableSeats(dialogTable.table.id, nextSeats)}
          seats={seatsByTable.get(dialogTable.table.id) ?? []}
          summary={dialogTable}
          unseatedUnits={unseatedUnits}
        />
      ) : null}
    </DndContext>
  );
}

function SeatingStats({
  className,
  compact = false,
  totals,
}: {
  className?: string;
  compact?: boolean;
  totals: {
    potential: number;
    unconfirmed: number;
    seated: number;
    notSeated: number;
    roundTableCount: number;
    seatsAvailable: number;
    tablesNeeded: number;
  };
}) {
  const shortOnTables = totals.roundTableCount < totals.tablesNeeded;

  return (
    <div
      className={clsx(
        "flex items-center gap-x-3 gap-y-0.5 overflow-hidden text-xs text-[#7a1239]",
        compact ? "flex-wrap justify-end" : "flex-wrap",
        className,
      )}
    >
      <span className="whitespace-nowrap">
        <strong className="tabular-nums">{totals.seated}</strong>/<span className="tabular-nums">{totals.potential}</span>{" "}
        seated
      </span>
      {!compact || totals.notSeated > 0 ? (
        <span className="whitespace-nowrap">
          <strong className="tabular-nums">{totals.notSeated}</strong> not seated
        </span>
      ) : null}
      {!compact ? (
        <span className="whitespace-nowrap">
          <strong className="tabular-nums">{totals.unconfirmed}</strong> unconfirmed
        </span>
      ) : null}
      <span className={clsx("whitespace-nowrap", shortOnTables && "font-semibold text-[#b45309]")}>
        <strong className="tabular-nums">{totals.roundTableCount}</strong> tables
        {shortOnTables ? ` (need ~${totals.tablesNeeded})` : compact ? "" : ` · ${totals.seatsAvailable} seats`}
      </span>
    </div>
  );
}

function SaveIndicator({ onRetry, state }: { onRetry: () => void; state: SaveState }) {
  if (state.status === "error") {
    return (
      <button
        type="button"
        className="inline-flex h-10 items-center gap-1 rounded-full border border-[#dc2626] bg-[#fef2f2] px-3 text-xs font-bold text-[#991b1b]"
        onClick={onRetry}
        title={state.message}
      >
        <TriangleAlert size={15} aria-hidden="true" />
        <span className="hidden sm:inline">Retry</span>
      </button>
    );
  }

  return (
    <span
      aria-live="polite"
      className="inline-flex h-10 items-center gap-1 px-1 text-xs font-semibold text-[#7a1239]"
      title={state.message}
    >
      {state.status === "saving" ? (
        <LoaderCircle size={15} aria-hidden="true" className="animate-spin" />
      ) : (
        <CloudCheck size={16} aria-hidden="true" className="text-[#047857]" />
      )}
      <span className="hidden sm:inline">{state.status === "saving" ? "Saving…" : "Saved"}</span>
    </span>
  );
}

function DraggedPartyChip({ unit }: { unit: SeatingUnit }) {
  return (
    <div
      className={clsx(
        "flex w-max max-w-[18rem] cursor-grabbing items-center gap-2 rounded-xl border-[1.5px] px-3 py-2 text-base font-semibold shadow-[0_22px_44px_-18px_rgba(74,16,39,0.8)]",
        partyCardClasses(unit.status),
        isPartyUnconfirmed(unit) && "italic",
      )}
      style={{ transform: "rotate(-2deg)" }}
    >
      <PartyStatusIcon size={17} status={unit.status} />
      <span className="min-w-0 truncate">{unit.name}</span>
      <PartySeatsBadge className="text-sm not-italic" party={unit} />
    </div>
  );
}
