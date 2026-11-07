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
import clsx from "clsx";
import {
  ArrowLeft,
  CloudCheck,
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
  clampTableCenter,
  compareSeatingTables,
  createSeatingId,
  currentSeats,
  findOpenTableSpot,
  fullnessStyle,
  isPartyUnconfirmed,
  makeSeatingCsv,
  minimumRoomSize,
  partyMatchesSearch,
  partySeats,
  ROUND_TABLE_CAPACITY,
  searchTokens,
  tableFullTitle,
  type SeatingChartData,
  type SeatingParty,
  type SeatingRoom,
  type SeatingSeat,
  type SeatingTable,
} from "@/lib/seating";
import {
  addSeatingTable,
  deleteSeatingTable,
  labelSeatingTable,
  loadSeatingChart,
  moveSeatingTable,
  resizeSeatingRoom,
  saveTableSeats,
  seatParty,
  type SeatingActionResult,
} from "./actions";
import { PartyDialog, TableDialog } from "./seating-dialogs";
import { FloorPlan, type FloorPlanHandle } from "./seating-floor-plan";
import { SeatingSidebar, UNSEATED_SECTION_ID } from "./seating-sidebar";
import {
  isBoolean,
  isStringArray,
  partyCardClasses,
  PartySeatsBadge,
  PartyStatusIcon,
  useStoredState,
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
  | { type: "party"; partyId: number }
  | { type: "table"; tableId: string; focusLabel: boolean }
  | null;

type MobileView = "list" | "plan";

const STATUS_RANK = { yes: 0, deciding: 1, none: 2, no: 3 } as const;
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

    const priority = data.type === "table" ? 0 : data.type === "unseated" ? 1 : 2;
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
  const stateRef = useRef({ room, tables, parties, seats });
  stateRef.current = { room, tables, parties, seats };

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

  const { seatNumbersByParty, seatedNumbersByTable, seatsByTable } = useMemo(() => {
    const byParty = new Map<number, number[]>();
    const numbersByTable = new Map<string, Set<number>>();
    const byTable = new Map<string, SeatingSeat[]>();

    for (const seat of validSeats) {
      byParty.set(seat.partyId, [...(byParty.get(seat.partyId) ?? []), seat.seatNumber].sort((a, b) => a - b));
      numbersByTable.set(seat.tableId, (numbersByTable.get(seat.tableId) ?? new Set()).add(seat.seatNumber));
      byTable.set(seat.tableId, [...(byTable.get(seat.tableId) ?? []), seat]);
    }

    return { seatNumbersByParty: byParty, seatedNumbersByTable: numbersByTable, seatsByTable: byTable };
  }, [validSeats]);

  const summaries = useMemo<TableSummary[]>(() => {
    const partiesByTable = new Map<string, SeatingParty[]>();

    for (const party of parties) {
      if (party.tableId && tableIds.has(party.tableId)) {
        partiesByTable.set(party.tableId, [...(partiesByTable.get(party.tableId) ?? []), party]);
      }
    }

    return sortedTables.map((table) => {
      const tableParties = (partiesByTable.get(table.id) ?? []).sort(
        (a, b) => (a.assignedAt ?? 0) - (b.assignedAt ?? 0) || a.sortOrder - b.sortOrder || a.id - b.id,
      );
      let count = 0;
      let unconfirmed = 0;

      for (const party of tableParties) {
        const partyCount = partySeats(party);
        count += partyCount;
        if (isPartyUnconfirmed(party)) {
          unconfirmed += partyCount;
        }
      }

      return { table, parties: tableParties, count, unconfirmed, style: fullnessStyle(count, table.capacity) };
    });
  }, [parties, sortedTables, tableIds]);

  const summaryById = useMemo(() => new Map(summaries.map((summary) => [summary.table.id, summary])), [summaries]);

  // Confirmed first, then maybes, then no reply; guest-list order within each.
  const unseatedParties = useMemo(
    () =>
      parties
        .filter((party) => partySeats(party) > 0 && !(party.tableId && tableIds.has(party.tableId)))
        .sort(
          (a, b) =>
            STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.sortOrder - b.sortOrder || a.id - b.id,
        ),
    [parties, tableIds],
  );

  const totals = useMemo(() => {
    let potential = 0;
    let unconfirmed = 0;
    let seated = 0;

    for (const party of parties) {
      const partyCount = partySeats(party);
      potential += partyCount;
      if (isPartyUnconfirmed(party)) {
        unconfirmed += partyCount;
      }
      if (party.tableId && tableIds.has(party.tableId)) {
        seated += partyCount;
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
  }, [parties, tableIds, tables]);

  const searchTokenList = useMemo(() => searchTokens(query), [query]);
  const matchingPartyIds = useMemo(
    () =>
      searchTokenList.length
        ? new Set(parties.filter((party) => partyMatchesSearch(party, searchTokenList)).map((party) => party.id))
        : null,
    [parties, searchTokenList],
  );

  const draggingParty =
    activeDrag?.type === "party" ? parties.find((party) => party.id === activeDrag.partyId) ?? null : null;

  // While dragging a party, show what the source and target tables would hold.
  const previewCounts = useMemo(() => {
    const counts = new Map<string, number>();

    if (!draggingParty || !overDrop || overDrop.type === "room") {
      return counts;
    }

    const sourceTableId = draggingParty.tableId && tableIds.has(draggingParty.tableId) ? draggingParty.tableId : null;
    const targetTableId = overDrop.type === "table" ? overDrop.tableId : null;

    if (sourceTableId === targetTableId) {
      return counts;
    }

    const partyCount = partySeats(draggingParty);
    if (targetTableId) {
      counts.set(targetTableId, (summaryById.get(targetTableId)?.count ?? 0) + partyCount);
    }
    if (sourceTableId) {
      counts.set(sourceTableId, (summaryById.get(sourceTableId)?.count ?? 0) - partyCount);
    }

    return counts;
  }, [draggingParty, overDrop, summaryById, tableIds]);

  // ---------- Edits (optimistic, then autosaved) ----------

  const flashTable = useCallback((tableId: string) => {
    setFlashTableId(tableId);
    if (flashTimeoutRef.current !== null) {
      window.clearTimeout(flashTimeoutRef.current);
    }
    flashTimeoutRef.current = window.setTimeout(() => setFlashTableId(null), 1400);
  }, []);

  const assignParty = useCallback(
    (partyId: number, tableId: string | null) => {
      const party = stateRef.current.parties.find((candidate) => candidate.id === partyId);

      if (!party || party.tableId === tableId) {
        return;
      }

      setParties((current) =>
        current.map((candidate) =>
          candidate.id === partyId ? { ...candidate, tableId, assignedAt: tableId ? Date.now() : null } : candidate,
        ),
      );
      // Exact seats belong to the old table.
      setSeats((current) => current.filter((seat) => seat.partyId !== partyId));
      enqueueSave({ key: `party:${partyId}`, run: () => seatParty(partyId, tableId) });

      if (tableId) {
        flashTable(tableId);
      }
    },
    [enqueueSave, flashTable],
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

  const deleteTable = useCallback(
    (tableId: string) => {
      setTables((current) => current.filter((table) => table.id !== tableId));
      setParties((current) =>
        current.map((party) => (party.tableId === tableId ? { ...party, tableId: null, assignedAt: null } : party)),
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

  const openParty = useCallback((partyId: number) => setDialog({ type: "party", partyId }), []);
  const openTable = useCallback(
    (tableId: string) => setDialog({ type: "table", tableId, focusLabel: false }),
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
      setCollapsedList(collapsed ? [UNSEATED_SECTION_ID, ...stateRef.current.tables.map((table) => table.id)] : []);
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
    const csv = makeSeatingCsv({ room, tables, parties, seats });
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
        assignParty(drag.partyId, over.tableId);
      } else if (over?.type === "unseated") {
        assignParty(drag.partyId, null);
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
      return stateRef.current.parties.find((party) => party.id === drag.partyId)?.name ?? "party";
    }
    if (drag?.type === "table") {
      const table = stateRef.current.tables.find((candidate) => candidate.id === drag.tableId);
      return table ? tableFullTitle(table) : "table";
    }
    return "item";
  }

  function describeDrop(drop: DropData | undefined) {
    if (drop?.type === "table") {
      const table = stateRef.current.tables.find((candidate) => candidate.id === drop.tableId);
      return table ? tableFullTitle(table) : "a table";
    }
    return drop?.type === "unseated" ? "Not seated" : "the floor";
  }

  const dropTableId = activeDrag?.type === "party" && overDrop?.type === "table" ? overDrop.tableId : null;
  const highlightedTableId = dropTableId ?? hoveredTableId ?? flashTableId;

  // ---------- Dialog data ----------

  const dialogParty = dialog?.type === "party" ? parties.find((party) => party.id === dialog.partyId) ?? null : null;
  const dialogTable = dialog?.type === "table" ? summaryById.get(dialog.tableId) ?? null : null;

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
            draggingPartyId={draggingParty?.id ?? null}
            dropTarget={activeDrag?.type === "party" ? overDrop : null}
            matchingPartyIds={matchingPartyIds}
            onHoverTable={setHoveredTableId}
            onLocateTable={locateTable}
            onOpenParty={openParty}
            onOpenTable={openTable}
            onQueryChange={setQuery}
            onSetAllCollapsed={setAllCollapsed}
            onToggleSection={toggleSection}
            previewCounts={previewCounts}
            query={query}
            seatNumbersByParty={seatNumbersByParty}
            summaries={summaries}
            unseatedParties={unseatedParties}
          />
          <section
            aria-label="Floor plan"
            className={clsx("min-w-0 flex-1 flex-col", mobileView === "list" ? "hidden md:flex" : "flex")}
            data-seating-clip
          >
            <FloorPlan
              ref={planRef}
              draggingPartyId={draggingParty?.id ?? null}
              draggingTableId={activeDrag?.type === "table" ? activeDrag.tableId : null}
              dropTableId={dropTableId}
              highlightedTableId={highlightedTableId}
              matchingPartyIds={matchingPartyIds}
              onOpenParty={openParty}
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

      <DragOverlay dropAnimation={null} modifiers={draggingParty ? [snapCenterToCursor] : undefined}>
        {draggingParty ? <DraggedPartyChip party={draggingParty} /> : null}
      </DragOverlay>

      {dialogParty ? (
        <PartyDialog
          key={`party-${dialogParty.id}`}
          currentSummary={dialogParty.tableId ? summaryById.get(dialogParty.tableId) ?? null : null}
          onAssign={(tableId) => {
            assignParty(dialogParty.id, tableId);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
          onOpenTable={openTable}
          party={dialogParty}
          seatNumbers={seatNumbersByParty.get(dialogParty.id)}
          summaries={summaries}
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
          onAssignParty={assignParty}
          onClose={() => setDialog(null)}
          onDelete={() => deleteTable(dialogTable.table.id)}
          onLabel={(number, name) => labelTable(dialogTable.table.id, number, name)}
          onOpenParty={openParty}
          onSetSeats={(nextSeats) => setTableSeats(dialogTable.table.id, nextSeats)}
          seats={seatsByTable.get(dialogTable.table.id) ?? []}
          summary={dialogTable}
          unseatedParties={unseatedParties}
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

function DraggedPartyChip({ party }: { party: SeatingParty }) {
  return (
    <div
      className={clsx(
        "flex w-max max-w-[18rem] cursor-grabbing items-center gap-2 rounded-xl border-[1.5px] px-3 py-2 text-base font-semibold shadow-[0_22px_44px_-18px_rgba(74,16,39,0.8)]",
        partyCardClasses(party.status),
        isPartyUnconfirmed(party) && "italic",
      )}
      style={{ transform: "rotate(-2deg)" }}
    >
      <PartyStatusIcon size={17} status={party.status} />
      <span className="min-w-0 truncate">{party.name}</span>
      <PartySeatsBadge className="text-sm not-italic" party={party} />
    </div>
  );
}
