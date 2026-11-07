"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { usePinch } from "@use-gesture/react";
import clsx from "clsx";
import { Heart, Minus, Plus, Scan } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from "react";
import {
  clamp,
  clampTableCenter,
  fullnessStyle,
  isPartyUnconfirmed,
  minimumRoomSize,
  ROOM_MAX_SIZE,
  tableFullTitle,
  tableSize,
  type SeatingParty,
  type SeatingRoom,
} from "@/lib/seating";
import {
  partyAriaLabel,
  partyCardClasses,
  PartySeatsBadge,
  type DropData,
  type PartyDragData,
  type TableDragData,
  type TableSummary,
} from "./seating-ui";

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 2.5;
const FIT_MAX_ZOOM = 1.25;
const ZOOM_STEP = 1.25;
/** Screen-pixel gutter around the room inside the scrolling viewport. */
const VIEW_PADDING = 28;
/** Below this zoom, tables show just their name and headcount. */
const DETAIL_ZOOM = 0.5;
const RESIZE_AUTO_SCROLL_EDGE = 36;
/** ctrl/cmd + wheel zoom: e^(-deltaY * speed), with deltaY capped per event. */
const WHEEL_ZOOM_SPEED = 0.01;
const WHEEL_ZOOM_MAX_DELTA = 24;

export type FloorPlanHandle = {
  revealTable: (tableId: string) => void;
};

type FloorPlanProps = {
  ref?: Ref<FloorPlanHandle>;
  room: SeatingRoom;
  summaries: TableSummary[];
  zoomRef: RefObject<number>;
  draggingPartyId: number | null;
  draggingTableId: string | null;
  dropTableId: string | null;
  previewCounts: ReadonlyMap<string, number>;
  highlightedTableId: string | null;
  matchingPartyIds: ReadonlySet<number> | null;
  seatedNumbersByTable: ReadonlyMap<string, ReadonlySet<number>>;
  onOpenParty: (partyId: number) => void;
  onOpenTable: (tableId: string) => void;
  onResizeRoom: (room: SeatingRoom) => void;
};

type ViewportSize = { width: number; height: number };

type ResizeEdge = "right" | "bottom" | "corner";

type ResizeSession = {
  edge: ResizeEdge;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  startScrollTop: number;
  startWidth: number;
  startHeight: number;
  lastClientX: number;
  lastClientY: number;
  minWidth: number;
  minHeight: number;
};

function fitZoom(viewport: ViewportSize, room: SeatingRoom) {
  const zoom = Math.min(
    (viewport.width - VIEW_PADDING * 2) / room.width,
    (viewport.height - VIEW_PADDING * 2) / room.height,
  );

  return clamp(zoom, MIN_ZOOM, FIT_MAX_ZOOM);
}

/** Capture can fail if the pointer is already gone; the handlers still work without it. */
function capturePointer(element: Element, pointerId: number) {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Keep going uncaptured.
  }
}

export function FloorPlan({
  draggingPartyId,
  draggingTableId,
  dropTableId,
  highlightedTableId,
  matchingPartyIds,
  onOpenParty,
  onOpenTable,
  onResizeRoom,
  previewCounts,
  ref,
  room,
  seatedNumbersByTable,
  summaries,
  zoomRef,
}: FloorPlanProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [liveRoom, setLiveRoom] = useState<SeatingRoom | null>(null);
  const [anchoredOrigin, setAnchoredOrigin] = useState<{ left: number; top: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  // Keep fitting the room to the screen until someone zooms by hand.
  const autoFitRef = useRef(true);
  const pendingScrollRef = useRef<{ ux: number; uy: number; cx: number; cy: number } | null>(null);
  const resizeRef = useRef<ResizeSession | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const panRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);

  const tables = useMemo(() => summaries.map((summary) => summary.table), [summaries]);
  const minimumRoom = useMemo(() => minimumRoomSize(tables), [tables]);
  // Never draw the room smaller than its tables, even if the saved size is.
  const baseRoom = useMemo(
    () => ({
      width: Math.max(room.width, minimumRoom.width),
      height: Math.max(room.height, minimumRoom.height),
    }),
    [minimumRoom, room.height, room.width],
  );
  const effectiveRoom = liveRoom ?? baseRoom;
  const scaledWidth = effectiveRoom.width * zoom;
  const scaledHeight = effectiveRoom.height * zoom;
  const origin = anchoredOrigin ?? {
    left: Math.max(VIEW_PADDING, (viewportSize.width - scaledWidth) / 2),
    top: Math.max(VIEW_PADDING, (viewportSize.height - scaledHeight) / 2),
  };
  const contentWidth = Math.max(viewportSize.width, origin.left + scaledWidth + VIEW_PADDING);
  const contentHeight = Math.max(viewportSize.height, origin.top + scaledHeight + VIEW_PADDING);
  const layoutRef = useRef({ origin, zoom });
  layoutRef.current = { origin, zoom };
  zoomRef.current = zoom;

  const roomDrop = useDroppable({
    id: "plan-room",
    data: { type: "room", area: "plan" } satisfies DropData,
  });

  const applyZoom = useCallback(
    (nextZoom: number, clientPoint?: { clientX: number; clientY: number }) => {
      const viewport = viewportRef.current;
      const clamped = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);

      if (!viewport || Math.abs(clamped - zoomRef.current) < 0.0001) {
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const cx = clientPoint ? clientPoint.clientX - rect.left : viewport.clientWidth / 2;
      const cy = clientPoint ? clientPoint.clientY - rect.top : viewport.clientHeight / 2;
      const { origin: currentOrigin, zoom: currentZoom } = layoutRef.current;

      pendingScrollRef.current = {
        ux: (viewport.scrollLeft + cx - currentOrigin.left) / currentZoom,
        uy: (viewport.scrollTop + cy - currentOrigin.top) / currentZoom,
        cx,
        cy,
      };
      setAnchoredOrigin(null);
      // Rapid wheel/pinch events build on each other before React re-renders.
      zoomRef.current = clamped;
      setZoom(clamped);
    },
    [zoomRef],
  );

  const zoomByHand = useCallback(
    (nextZoom: number, clientPoint?: { clientX: number; clientY: number }) => {
      autoFitRef.current = false;
      applyZoom(nextZoom, clientPoint);
    },
    [applyZoom],
  );

  const fitToScreen = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport || viewport.clientWidth === 0) {
      return;
    }

    autoFitRef.current = true;
    pendingScrollRef.current = null;
    setAnchoredOrigin(null);
    setZoom(fitZoom({ width: viewport.clientWidth, height: viewport.clientHeight }, baseRoom));
    viewport.scrollTo({ left: 0, top: 0 });
  }, [baseRoom]);

  // Track the viewport size; it is 0x0 while hidden behind the mobile List tab.
  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    });
    observer.observe(viewport);

    return () => observer.disconnect();
  }, []);

  // Refit whenever the viewport changes size, until the user zooms manually.
  useLayoutEffect(() => {
    if (!autoFitRef.current || viewportSize.width === 0 || viewportSize.height === 0 || resizeRef.current) {
      return;
    }

    setAnchoredOrigin(null);
    setZoom(fitZoom(viewportSize, baseRoom));
    // Only refit on viewport changes, not every room/table edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportSize.width, viewportSize.height]);

  // After zooming, scroll so the point under the cursor/fingers stays put.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const pending = pendingScrollRef.current;

    if (!viewport || !pending) {
      return;
    }

    pendingScrollRef.current = null;
    viewport.scrollLeft = layoutRef.current.origin.left + pending.ux * zoom - pending.cx;
    viewport.scrollTop = layoutRef.current.origin.top + pending.uy * zoom - pending.cy;
  }, [zoom]);

  // Pinch on phones (and Safari trackpads) zooms around the fingers.
  usePinch(
    ({ event, offset: [scale], origin: [originX, originY] }) => {
      if ("touches" in event && event.cancelable) {
        event.preventDefault();
      }
      zoomByHand(scale, { clientX: originX, clientY: originY });
    },
    {
      target: viewportRef,
      eventOptions: { passive: false },
      from: () => [zoomRef.current, 0],
      pinchOnWheel: false,
      pointer: { touch: true },
      scaleBounds: { min: MIN_ZOOM, max: MAX_ZOOM },
    },
  );

  // Trackpad pinches (ctrl + wheel) and ctrl/cmd + mouse wheel zoom around the cursor.
  // Zoom exponentially so zooming in and back out lands where it started, and cap each
  // step so one mouse-wheel notch is about one zoom-button press.
  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      event.preventDefault();
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 400 : 1;
      const delta = clamp(event.deltaY * unit, -WHEEL_ZOOM_MAX_DELTA, WHEEL_ZOOM_MAX_DELTA);
      zoomByHand(zoomRef.current * Math.exp(-delta * WHEEL_ZOOM_SPEED), {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [zoomByHand, zoomRef]);

  useImperativeHandle(
    ref,
    () => ({
      revealTable(tableId: string) {
        const viewport = viewportRef.current;
        const table = tables.find((candidate) => candidate.id === tableId);

        if (!viewport || !table || viewport.clientWidth === 0) {
          return;
        }

        const { origin: currentOrigin, zoom: currentZoom } = layoutRef.current;
        const x = currentOrigin.left + table.x * currentZoom;
        const y = currentOrigin.top + table.y * currentZoom;
        const margin = (tableSize(table.kind).width / 2) * currentZoom + 16;
        const visible =
          x - margin >= viewport.scrollLeft &&
          x + margin <= viewport.scrollLeft + viewport.clientWidth &&
          y - margin >= viewport.scrollTop &&
          y + margin <= viewport.scrollTop + viewport.clientHeight;

        if (!visible) {
          viewport.scrollTo({
            left: x - viewport.clientWidth / 2,
            top: y - viewport.clientHeight / 2,
            behavior: "smooth",
          });
        }
      },
    }),
    [tables],
  );

  const computeResize = useCallback((session: ResizeSession) => {
    const viewport = viewportRef.current;
    const currentZoom = layoutRef.current.zoom;
    const scrollDx = viewport ? viewport.scrollLeft - session.startScrollLeft : 0;
    const scrollDy = viewport ? viewport.scrollTop - session.startScrollTop : 0;
    const dx = (session.lastClientX - session.startClientX + scrollDx) / currentZoom;
    const dy = (session.lastClientY - session.startClientY + scrollDy) / currentZoom;

    return {
      width: session.edge === "bottom"
        ? session.startWidth
        : Math.round(clamp(session.startWidth + dx, session.minWidth, ROOM_MAX_SIZE)),
      height: session.edge === "right"
        ? session.startHeight
        : Math.round(clamp(session.startHeight + dy, session.minHeight, ROOM_MAX_SIZE)),
    };
  }, []);

  const updateResize = useCallback(() => {
    const session = resizeRef.current;

    if (!session) {
      return;
    }

    const { width, height } = computeResize(session);
    setLiveRoom((current) =>
      current && current.width === width && current.height === height ? current : { width, height },
    );
  }, [computeResize]);

  // While resizing near the viewport edge, keep scrolling so the room can keep growing.
  const runResizeAutoScroll = useCallback(() => {
    const session = resizeRef.current;
    const viewport = viewportRef.current;

    if (!session || !viewport) {
      autoScrollFrameRef.current = null;
      return;
    }

    const rect = viewport.getBoundingClientRect();
    let scrollX = 0;
    let scrollY = 0;

    if (session.edge !== "bottom" && session.lastClientX > rect.right - RESIZE_AUTO_SCROLL_EDGE) {
      scrollX = Math.min(24, (session.lastClientX - (rect.right - RESIZE_AUTO_SCROLL_EDGE)) / 2 + 4);
    }
    if (session.edge !== "right" && session.lastClientY > rect.bottom - RESIZE_AUTO_SCROLL_EDGE) {
      scrollY = Math.min(24, (session.lastClientY - (rect.bottom - RESIZE_AUTO_SCROLL_EDGE)) / 2 + 4);
    }

    if (scrollX || scrollY) {
      viewport.scrollBy(scrollX, scrollY);
      updateResize();
    }

    autoScrollFrameRef.current = window.requestAnimationFrame(runResizeAutoScroll);
  }, [updateResize]);

  function handleResizeStart(edge: ResizeEdge, event: React.PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;

    if (!viewport || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    capturePointer(event.currentTarget, event.pointerId);
    resizeRef.current = {
      edge,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: viewport.scrollLeft,
      startScrollTop: viewport.scrollTop,
      startWidth: effectiveRoom.width,
      startHeight: effectiveRoom.height,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      minWidth: minimumRoom.width,
      minHeight: minimumRoom.height,
    };
    // Pin the room's top-left corner while resizing so the handle tracks the pointer.
    setAnchoredOrigin(origin);
    setLiveRoom(effectiveRoom);
    autoScrollFrameRef.current = window.requestAnimationFrame(runResizeAutoScroll);
  }

  function handleResizeMove(event: React.PointerEvent<HTMLDivElement>) {
    const session = resizeRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    session.lastClientX = event.clientX;
    session.lastClientY = event.clientY;
    updateResize();
  }

  function handleResizeEnd(event: React.PointerEvent<HTMLDivElement>) {
    const session = resizeRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    resizeRef.current = null;
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }

    session.lastClientX = event.clientX;
    session.lastClientY = event.clientY;
    const finalRoom = computeResize(session);
    setLiveRoom(null);

    if (finalRoom.width !== room.width || finalRoom.height !== room.height) {
      onResizeRoom(finalRoom);
    }
  }

  useEffect(
    () => () => {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
      }
    },
    [],
  );

  // Mouse users can drag the empty floor to pan (touch pans natively).
  function handlePanStart(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const viewport = viewportRef.current;

    if (
      !viewport ||
      event.pointerType !== "mouse" ||
      (event.button !== 0 && event.button !== 1) ||
      !target.closest("[data-pan-surface]") ||
      target.closest("[data-no-pan]")
    ) {
      return;
    }

    event.preventDefault();
    capturePointer(event.currentTarget, event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
    setIsPanning(true);
  }

  function handlePanMove(event: React.PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    const viewport = viewportRef.current;

    if (!pan || !viewport || pan.pointerId !== event.pointerId) {
      return;
    }

    viewport.scrollLeft = pan.left - (event.clientX - pan.x);
    viewport.scrollTop = pan.top - (event.clientY - pan.y);
  }

  function handlePanEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
      setIsPanning(false);
    }
  }

  const detail = zoom >= DETAIL_ZOOM;
  const hasRoundTables = summaries.some((summary) => summary.table.kind === "round");
  const isResizing = liveRoom !== null;
  const handleThickness = 18;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#f7e3ec]">
      <div
        ref={viewportRef}
        className={clsx(
          "seating-plan-viewport relative min-h-0 flex-1 overflow-auto overscroll-contain",
          isPanning && "cursor-grabbing",
        )}
        onPointerDown={handlePanStart}
        onPointerMove={handlePanMove}
        onPointerUp={handlePanEnd}
        onPointerCancel={handlePanEnd}
      >
        <div
          ref={roomDrop.setNodeRef}
          className="relative"
          data-pan-surface
          style={{ width: contentWidth, height: contentHeight }}
        >
          <div
            className={clsx(
              "seating-room absolute left-0 top-0 origin-top-left rounded-[10px] border-[#df7fa3] bg-[#fffdfd]",
              isResizing && "seating-room-resizing",
            )}
            data-pan-surface
            style={{
              width: effectiveRoom.width,
              height: effectiveRoom.height,
              borderWidth: Math.max(2, 1.5 / zoom),
              transform: `translate(${origin.left}px, ${origin.top}px) scale(${zoom})`,
            }}
          >
            {!hasRoundTables ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-[12%] flex justify-center"
                style={{ fontSize: Math.max(18, 13 / zoom) }}
              >
                <p className="max-w-[80%] text-center font-semibold leading-snug text-[#a04670]">
                  No tables yet. Use <span className="whitespace-nowrap">“+ Table”</span> to add 12-person
                  tables, then drag them where they go.
                </p>
              </div>
            ) : null}
            {summaries.map((summary) => (
              <PlanTable
                key={summary.table.id}
                detail={detail}
                draggingPartyId={draggingPartyId}
                highlighted={highlightedTableId === summary.table.id}
                isDropTarget={dropTableId === summary.table.id}
                isMoving={draggingTableId === summary.table.id}
                matchingPartyIds={matchingPartyIds}
                onOpenParty={onOpenParty}
                onOpenTable={onOpenTable}
                previewCount={previewCounts.get(summary.table.id)}
                roomHeight={effectiveRoom.height}
                roomWidth={effectiveRoom.width}
                seatedNumbers={seatedNumbersByTable.get(summary.table.id)}
                summary={summary}
                zoom={zoom}
              />
            ))}
          </div>

          <div
            aria-label="Drag to resize the room's width"
            className="seating-resize-handle absolute cursor-ew-resize"
            data-no-pan
            role="separator"
            style={{
              left: origin.left + scaledWidth - handleThickness / 2,
              top: origin.top,
              width: handleThickness,
              height: scaledHeight,
            }}
            onPointerDown={(event) => handleResizeStart("right", event)}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
          >
            <span className="seating-resize-grip seating-resize-grip-vertical" />
          </div>
          <div
            aria-label="Drag to resize the room's height"
            className="seating-resize-handle absolute cursor-ns-resize"
            data-no-pan
            role="separator"
            style={{
              left: origin.left,
              top: origin.top + scaledHeight - handleThickness / 2,
              width: scaledWidth,
              height: handleThickness,
            }}
            onPointerDown={(event) => handleResizeStart("bottom", event)}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
          >
            <span className="seating-resize-grip seating-resize-grip-horizontal" />
          </div>
          <div
            aria-label="Drag to resize the room"
            className="seating-resize-corner absolute cursor-nwse-resize"
            data-no-pan
            role="separator"
            style={{
              left: origin.left + scaledWidth - 20,
              top: origin.top + scaledHeight - 20,
            }}
            onPointerDown={(event) => handleResizeStart("corner", event)}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
              <path d="M14 6 6 14M14 10l-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>

          {isResizing ? (
            <div
              className="pointer-events-none absolute rounded-md bg-[#4a1027] px-2 py-1 text-xs font-bold tabular-nums text-white shadow-lg"
              style={{
                left: origin.left + scaledWidth + 12,
                top: origin.top + scaledHeight + 12,
              }}
            >
              {effectiveRoom.width} × {effectiveRoom.height}
            </div>
          ) : null}
        </div>
      </div>

      <FullnessLegend />

      <div className="pointer-events-none absolute bottom-3 right-3 flex items-end gap-2 pb-[env(safe-area-inset-bottom)]">
        <div className="pointer-events-auto flex items-center overflow-hidden rounded-full border border-[#df7fa3] bg-[#fff8fb]/95 text-[#7a1239] shadow-[0_10px_24px_-14px_rgba(74,16,39,0.7)] backdrop-blur">
          <button
            type="button"
            aria-label="Zoom out"
            className="grid size-10 place-items-center transition hover:bg-[#ffe0ec]"
            onClick={() => zoomByHand(zoom / ZOOM_STEP)}
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Zoom to 100%"
            className="h-10 min-w-14 border-x border-[#efb5c9] px-1 text-xs font-bold tabular-nums transition hover:bg-[#ffe0ec]"
            onClick={() => zoomByHand(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            className="grid size-10 place-items-center transition hover:bg-[#ffe0ec]"
            onClick={() => zoomByHand(zoom * ZOOM_STEP)}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Fit the room to the screen"
            className="grid size-10 place-items-center border-l border-[#efb5c9] transition hover:bg-[#ffe0ec]"
            onClick={fitToScreen}
            title="Fit to screen"
          >
            <Scan size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

const LEGEND_STEPS = [
  { count: 0, label: "0" },
  { count: 6, label: "" },
  { count: 9, label: "" },
  { count: 10, label: "10" },
  { count: 11, label: "11" },
  { count: 12, label: "12" },
  { count: 13, label: "13+" },
];

function FullnessLegend() {
  return (
    <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[#efb5c9] bg-[#fff8fb]/92 px-2.5 py-1.5 text-[0.7rem] font-semibold text-[#7a1239] shadow-[0_10px_24px_-18px_rgba(74,16,39,0.7)] backdrop-blur">
      <span className="flex items-center gap-1" aria-label="Table color by people seated: empty, filling, 10, 11, full at 12, over capacity">
        {LEGEND_STEPS.map((step) => {
          const style = fullnessStyle(step.count, 12);

          return (
            <span key={step.count} className="flex flex-col items-center gap-0.5" aria-hidden="true">
              <span
                className={clsx(
                  "block size-3.5 rounded-full border",
                  style.tone === "empty" && "border-dashed",
                  style.tone === "over" && "seating-over-stripes",
                )}
                style={{ backgroundColor: style.background, borderColor: style.border }}
              />
              <span className="h-2.5 text-[0.6rem] leading-none tabular-nums text-[#8f5070]">{step.label}</span>
            </span>
          );
        })}
      </span>
      <span className="flex items-center gap-1 text-[#8a3b06]">
        <span className="inline-block rounded-full border border-dashed border-[#d97706] bg-[#fffbeb] px-1.5 text-[0.65rem] italic leading-4">
          4?
        </span>
        unconfirmed
      </span>
    </div>
  );
}

type PlanTableProps = {
  detail: boolean;
  draggingPartyId: number | null;
  highlighted: boolean;
  isDropTarget: boolean;
  isMoving: boolean;
  matchingPartyIds: ReadonlySet<number> | null;
  onOpenParty: (partyId: number) => void;
  onOpenTable: (tableId: string) => void;
  previewCount: number | undefined;
  roomHeight: number;
  roomWidth: number;
  seatedNumbers: ReadonlySet<number> | undefined;
  summary: TableSummary;
  zoom: number;
};

const PlanTable = memo(function PlanTable({
  detail,
  draggingPartyId,
  highlighted,
  isDropTarget,
  isMoving,
  matchingPartyIds,
  onOpenParty,
  onOpenTable,
  previewCount,
  roomHeight,
  roomWidth,
  seatedNumbers,
  summary,
  zoom,
}: PlanTableProps) {
  const { table, parties } = summary;
  const round = table.kind === "round";
  const size = tableSize(table.kind);
  const count = previewCount ?? summary.count;
  const style = previewCount === undefined ? summary.style : fullnessStyle(previewCount, table.capacity);
  const drag = useDraggable({
    id: `move-table-${table.id}`,
    data: { type: "table", tableId: table.id } satisfies TableDragData,
  });
  const drop = useDroppable({
    id: `plan-table-${table.id}`,
    data: { type: "table", tableId: table.id, area: "plan", shape: round ? "round" : "rect" } satisfies DropData,
  });
  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      drag.setNodeRef(node);
      drop.setNodeRef(node);
    },
    // setNodeRef functions from dnd-kit are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  let translateX = 0;
  let translateY = 0;
  if (drag.transform) {
    const next = clampTableCenter(
      table.kind,
      table.x + drag.transform.x / zoom,
      table.y + drag.transform.y / zoom,
      { width: roomWidth, height: roomHeight },
    );
    translateX = next.x - table.x;
    translateY = next.y - table.y;
  }

  const matchCount = matchingPartyIds
    ? parties.filter((party) => matchingPartyIds.has(party.id)).length
    : 0;
  const dimmed = matchingPartyIds !== null && matchCount === 0;

  // Text stays readable at any zoom: grow it in room units as the room shrinks.
  const label = table.number || table.name || (round ? "New table" : "Sweetheart table");
  const labelIsNumber = Boolean(table.number);
  const showName = detail && labelIsNumber && Boolean(table.name);
  const numberFont = detail
    ? Math.max(26, 16 / zoom)
    : Math.min(Math.max(34, 18 / zoom), round ? 84 : 48);
  const nameFont = detail ? Math.max(13, 10 / zoom) : Math.min(Math.max(16, 12 / zoom), round ? 44 : 30);
  const labelFont = labelIsNumber ? numberFont : nameFont;
  const countFont = detail ? Math.max(14, 10.5 / zoom) : Math.min(Math.max(20, 13 / zoom), round ? 52 : 32);
  // Party names use the higher-x-height serif so they stay legible when small.
  const chipFont = Math.max(12, 10 / zoom);
  const rowHeight = chipFont * 1.52;
  const headerHeight = round
    ? detail && labelIsNumber
      ? numberFont * 1.05 + (showName ? nameFont * 1.2 : 0) + 6
      : labelFont * 1.15 + countFont * 1.25 + 6
    : Math.max(nameFont, countFont) * 1.35 + 8;
  const bodyHeight = round ? size.height * 0.82 - headerHeight : size.height - headerHeight - 14;
  const maxRows = Math.max(1, Math.floor(bodyHeight / rowHeight));
  const visibleParties = parties.length > maxRows ? parties.slice(0, maxRows - 1) : parties;
  const hiddenPartyCount = parties.length - visibleParties.length;
  // Each name row gets as much width as the circle allows at its height.
  const borderWidth = Math.max(3, 2 / zoom);
  const rowCount = visibleParties.length + (hiddenPartyCount > 0 ? 1 : 0);
  const blockTop = -(headerHeight + 3 + rowCount * rowHeight) / 2;
  const innerRadius = size.width / 2 - borderWidth;
  const chipMaxWidth = (index: number) => {
    if (!round) {
      return size.width - 28;
    }

    const centerY = blockTop + headerHeight + 3 + (index + 0.5) * rowHeight;
    const edgeY = Math.abs(centerY) + rowHeight / 2;
    const chord = 2 * Math.sqrt(Math.max(0, innerRadius * innerRadius - edgeY * edgeY));

    return Math.max(size.width * 0.4, Math.min(size.width * 0.88, chord - chipFont * 1.1));
  };
  const countLabel = (
    <span className="whitespace-nowrap font-bold tabular-nums" style={{ fontSize: countFont }}>
      {count}/{table.capacity}
      {detail && summary.unconfirmed > 0 ? (
        <span className="ml-[0.2em] text-[0.85em] font-semibold italic opacity-80">({summary.unconfirmed}?)</span>
      ) : null}
    </span>
  );
  const ring = isDropTarget
    ? `0 0 0 ${Math.max(6, 5 / zoom)}px rgba(190, 24, 93, 0.55)`
    : highlighted
      ? `0 0 0 ${Math.max(5, 4 / zoom)}px rgba(236, 72, 153, 0.45)`
      : undefined;
  const shadow = isMoving
    ? `0 ${18 / zoom}px ${40 / zoom}px -${10 / zoom}px rgba(74, 16, 39, 0.55)`
    : `0 ${6 / zoom}px ${16 / zoom}px -${10 / zoom}px rgba(74, 16, 39, 0.45)`;

  return (
    <div
      ref={setNodeRef}
      {...drag.attributes}
      {...drag.listeners}
      aria-label={`${tableFullTitle(table)}: ${summary.count} of ${table.capacity} seats filled${
        summary.unconfirmed ? `, ${summary.unconfirmed} unconfirmed` : ""
      }. Drag to move; press Enter to edit.`}
      className={clsx(
        "seating-table absolute flex select-none flex-col items-center justify-center overflow-hidden text-center outline-none",
        round ? "rounded-full" : "rounded-[22px]",
        style.tone === "empty" && "border-dashed",
        style.tone === "over" && "seating-over-stripes",
        isMoving ? "z-30 cursor-grabbing" : "cursor-grab",
        dimmed && !isMoving && "opacity-30",
        "transition-[opacity,box-shadow] duration-150 focus-visible:ring-4 focus-visible:ring-[#be185d]/50",
      )}
      data-no-pan
      onClick={() => onOpenTable(table.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenTable(table.id);
        }
      }}
      style={{
        left: table.x - size.width / 2,
        top: table.y - size.height / 2,
        width: size.width,
        height: size.height,
        borderWidth,
        borderStyle: style.tone === "empty" ? "dashed" : "solid",
        borderColor: style.border,
        backgroundColor: style.background,
        color: style.text,
        boxShadow: [ring, shadow].filter(Boolean).join(", "),
        transform: `translate3d(${translateX}px, ${translateY}px, 0)`,
        padding: round ? size.width * 0.05 : `${8}px ${14}px`,
      }}
    >
      {round && detail && seatedNumbers && seatedNumbers.size > 0 ? (
        <SeatDots borderWidth={borderWidth} capacity={table.capacity} diameter={size.width} seated={seatedNumbers} zoom={zoom} />
      ) : null}
      {round ? (
        detail && labelIsNumber ? (
          <>
            <span className="flex max-w-[86%] items-baseline justify-center gap-[0.3em] leading-[1.05]">
              <span className="truncate font-bold tabular-nums" style={{ fontSize: numberFont }}>
                {label}
              </span>
              {countLabel}
            </span>
            {showName ? (
              <span
                className="block max-w-[74%] truncate font-semibold italic leading-[1.2] opacity-85"
                style={{ fontSize: nameFont }}
              >
                {table.name}
              </span>
            ) : null}
          </>
        ) : (
          <>
            <span
              className={clsx(
                "block max-w-[80%] truncate leading-[1.15]",
                labelIsNumber ? "font-bold tabular-nums" : "font-semibold",
                !table.number && !table.name && "italic opacity-70",
              )}
              style={{ fontSize: labelFont }}
            >
              {label}
            </span>
            <span className="leading-[1.25]">{countLabel}</span>
          </>
        )
      ) : (
        <span className="flex max-w-full items-center justify-center gap-[0.3em] leading-[1.25]">
          <Heart aria-hidden="true" className="shrink-0 fill-current" size={nameFont} />
          {detail ? (
            <span className="truncate font-semibold" style={{ fontSize: nameFont }}>
              {table.number ? `${table.number} · ` : ""}
              {table.name || "Sweetheart table"}
            </span>
          ) : null}
          <span className="ml-[0.2em]">{countLabel}</span>
        </span>
      )}
      {detail && parties.length > 0 ? (
        <span
          className="mt-[3px] flex w-full flex-col items-center"
          style={{ gap: chipFont * 0.16 }}
        >
          {visibleParties.map((party, index) => (
            <PlanPartyChip
              key={party.id}
              fontSize={chipFont}
              isDragging={draggingPartyId === party.id}
              isMatch={matchingPartyIds?.has(party.id) ?? false}
              maxWidth={chipMaxWidth(index)}
              onOpenParty={onOpenParty}
              party={party}
            />
          ))}
          {hiddenPartyCount > 0 ? (
            <span className="font-semibold leading-tight opacity-80" style={{ fontSize: chipFont * 0.9 }}>
              +{hiddenPartyCount} more
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
});

function PlanPartyChip({
  fontSize,
  isDragging,
  isMatch,
  maxWidth,
  onOpenParty,
  party,
}: {
  fontSize: number;
  isDragging: boolean;
  isMatch: boolean;
  maxWidth: number;
  onOpenParty: (partyId: number) => void;
  party: SeatingParty;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `party-plan-${party.id}`,
    data: { type: "party", partyId: party.id } satisfies PartyDragData,
  });
  const unconfirmed = isPartyUnconfirmed(party);

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`${partyAriaLabel(party)}. Drag to another table, or click for options.`}
      className={clsx(
        "seating-chip seating-chip-plan flex min-w-0 cursor-grab items-center gap-[0.3em] rounded-full border pl-[0.5em] pr-[0.15em] leading-[1.25] shadow-[0_1px_0_rgba(74,16,39,0.08)]",
        partyCardClasses(party.status),
        unconfirmed && "italic",
        party.status === "no" && "line-through",
        isDragging && "opacity-30",
        isMatch && "ring-[3px] ring-[#ec4899]",
      )}
      data-no-pan
      onClick={(event) => {
        event.stopPropagation();
        onOpenParty(party.id);
      }}
      onKeyDown={(event) => event.stopPropagation()}
      style={{ fontSize, maxWidth, paddingTop: fontSize * 0.06, paddingBottom: fontSize * 0.06 }}
    >
      <span className="min-w-0 truncate">{party.name}</span>
      <PartySeatsBadge className="text-[0.8em] not-italic" party={party} />
    </button>
  );
}

/** Small marks around the rim showing which exact seats are taken (only once any are). */
function SeatDots({
  borderWidth,
  capacity,
  diameter,
  seated,
  zoom,
}: {
  borderWidth: number;
  capacity: number;
  diameter: number;
  seated: ReadonlySet<number>;
  zoom: number;
}) {
  const dot = Math.max(4.5, 3.2 / zoom);
  const radius = diameter / 2 - borderWidth - dot - Math.max(3, 2 / zoom);

  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {Array.from({ length: capacity }, (_, index) => {
        const angle = (index / capacity) * Math.PI * 2 - Math.PI / 2;
        const taken = seated.has(index + 1);

        return (
          <span
            key={index}
            className="absolute rounded-full"
            style={{
              left: diameter / 2 - borderWidth + Math.cos(angle) * radius - dot,
              top: diameter / 2 - borderWidth + Math.sin(angle) * radius - dot,
              width: dot * 2,
              height: dot * 2,
              backgroundColor: taken ? "currentColor" : "transparent",
              border: `${Math.max(1.5, 1 / zoom)}px solid currentColor`,
              opacity: taken ? 0.75 : 0.35,
            }}
          />
        );
      })}
    </span>
  );
}
