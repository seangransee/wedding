"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { usePinch } from "@use-gesture/react";
import clsx from "clsx";
import { Heart, Inbox, Minus, Plus, Scan } from "lucide-react";
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
  BUCKET_WIDTH,
  bucketTitle,
  clamp,
  clampBucketPosition,
  clampTableCenter,
  estimatedBucketHeight,
  fullnessStyle,
  isPartyUnconfirmed,
  minimumRoomSize,
  ROOM_MAX_SIZE,
  tableFullTitle,
  tableSize,
  type SeatingRoom,
  type SeatingUnit,
} from "@/lib/seating";
import { CHIP_GAP_EM, CHIP_LINE_GAP_EM, layoutTableChips } from "@/lib/seating-chip-layout";
import { chipTextEm, useChipTextVersion } from "./chip-text-metrics";
import {
  type BucketDragData,
  type BucketSummary,
  partyAriaLabel,
  partyCardClasses,
  PartySeatsBadge,
  partySeatsLabel,
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
  /** Converts a screen point to room units, or null if it isn't over the floor plan. */
  clientToRoom: (clientX: number, clientY: number) => { x: number; y: number } | null;
};

/** Bubble chip text grows in room units as the room shrinks, like table chips. */
function bubbleChipFont(zoom: number) {
  return Math.max(12, 10 / zoom);
}

/** Top-left corner for a new bubble so a one-name bubble sits centered on the drop point. */
export function bubbleDropPosition(point: { x: number; y: number }, zoom: number) {
  const font = bubbleChipFont(zoom);
  return clampBucketPosition(point.x - font * 4.5, point.y - font * 1.1);
}

type FloorPlanProps = {
  ref?: Ref<FloorPlanHandle>;
  room: SeatingRoom;
  summaries: TableSummary[];
  bucketSummaries: BucketSummary[];
  draggingBucketId: string | null;
  dropBucketId: string | null;
  onOpenBucket: (bucketId: string) => void;
  zoomRef: RefObject<number>;
  draggingUnitId: string | null;
  draggingTableId: string | null;
  dropTableId: string | null;
  previewCounts: ReadonlyMap<string, number>;
  highlightedTableId: string | null;
  matchingUnitIds: ReadonlySet<string> | null;
  seatedNumbersByTable: ReadonlyMap<string, ReadonlySet<number>>;
  onOpenUnit: (unitId: string) => void;
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
  bucketSummaries,
  draggingBucketId,
  dropBucketId,
  onOpenBucket,
  draggingUnitId,
  draggingTableId,
  dropTableId,
  highlightedTableId,
  matchingUnitIds,
  onOpenUnit,
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

  // Buckets can sit outside the room, so the scrollable area covers the room
  // plus every bucket. Bucket heights are measured once rendered.
  const [bucketSizes, setBucketSizes] = useState<ReadonlyMap<string, { width: number; height: number }>>(new Map());
  const measureBucket = useCallback((bucketId: string, width: number, height: number) => {
    setBucketSizes((current) => {
      const previous = current.get(bucketId);
      if (previous?.width === width && previous.height === height) {
        return current;
      }
      const next = new Map(current);
      next.set(bucketId, { width, height });
      return next;
    });
  }, []);
  const bounds = useMemo(() => {
    let minX = 0;
    let minY = 0;
    let maxX = effectiveRoom.width;
    let maxY = effectiveRoom.height;

    for (const { bucket, units } of bucketSummaries) {
      const size = bucketSizes.get(bucket.id);
      minX = Math.min(minX, bucket.x);
      minY = Math.min(minY, bucket.y);
      maxX = Math.max(maxX, bucket.x + (size?.width ?? (bucket.bubble ? 140 : BUCKET_WIDTH)));
      maxY = Math.max(maxY, bucket.y + (size?.height ?? (bucket.bubble ? 40 * units.length : estimatedBucketHeight(units.length))));
    }

    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }, [bucketSizes, bucketSummaries, effectiveRoom.height, effectiveRoom.width]);

  // origin is where the room's top-left corner (room point 0,0) lands in the scroll area.
  const centeredOrigin = {
    left: Math.max(VIEW_PADDING, (viewportSize.width - bounds.width * zoom) / 2) - bounds.minX * zoom,
    top: Math.max(VIEW_PADDING, (viewportSize.height - bounds.height * zoom) / 2) - bounds.minY * zoom,
  };
  const origin = anchoredOrigin
    ? {
        left: Math.max(anchoredOrigin.left, VIEW_PADDING - bounds.minX * zoom),
        top: Math.max(anchoredOrigin.top, VIEW_PADDING - bounds.minY * zoom),
      }
    : centeredOrigin;
  const contentWidth = Math.max(viewportSize.width, origin.left + bounds.maxX * zoom + VIEW_PADDING);
  const contentHeight = Math.max(viewportSize.height, origin.top + bounds.maxY * zoom + VIEW_PADDING);
  const fitSize = useMemo(() => ({ width: bounds.width, height: bounds.height }), [bounds.height, bounds.width]);
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
    setZoom(fitZoom({ width: viewport.clientWidth, height: viewport.clientHeight }, fitSize));
    viewport.scrollTo({ left: 0, top: 0 });
  }, [fitSize]);

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
    setZoom(fitZoom(viewportSize, fitSize));
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

  // When a bucket moves past the top/left edge, everything shifts within the
  // scroll area; scroll by the same amount so the view doesn't jump.
  const previousOriginRef = useRef({ left: origin.left, top: origin.top, zoom });
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const previous = previousOriginRef.current;
    previousOriginRef.current = { left: origin.left, top: origin.top, zoom };

    if (!viewport || previous.zoom !== zoom || pendingScrollRef.current) {
      return;
    }

    const dx = origin.left - previous.left;
    const dy = origin.top - previous.top;
    if (dx || dy) {
      viewport.scrollLeft += dx;
      viewport.scrollTop += dy;
    }
  }, [origin.left, origin.top, zoom]);

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
        const bucket = bucketSummaries.find((summary) => summary.bucket.id === tableId)?.bucket;
        const place = table
          ? { x: table.x, y: table.y, radius: tableSize(table.kind).width / 2 }
          : bucket
            ? bucket.bubble
              ? { x: bucket.x + 60, y: bucket.y + 20, radius: 80 }
              : { x: bucket.x + BUCKET_WIDTH / 2, y: bucket.y + 60, radius: BUCKET_WIDTH / 2 }
            : null;

        if (!viewport || !place || viewport.clientWidth === 0) {
          return;
        }

        const { origin: currentOrigin, zoom: currentZoom } = layoutRef.current;
        const x = currentOrigin.left + place.x * currentZoom;
        const y = currentOrigin.top + place.y * currentZoom;
        const margin = place.radius * currentZoom + 16;
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
      clientToRoom(clientX: number, clientY: number) {
        const viewport = viewportRef.current;

        if (!viewport || viewport.clientWidth === 0) {
          return null;
        }

        const rect = viewport.getBoundingClientRect();
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
          return null;
        }

        const { origin: currentOrigin, zoom: currentZoom } = layoutRef.current;
        return {
          x: (viewport.scrollLeft + clientX - rect.left - currentOrigin.left) / currentZoom,
          y: (viewport.scrollTop + clientY - rect.top - currentOrigin.top) / currentZoom,
        };
      },
    }),
    [bucketSummaries, tables],
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
                draggingUnitId={draggingUnitId}
                highlighted={highlightedTableId === summary.table.id}
                isDropTarget={dropTableId === summary.table.id}
                isMoving={draggingTableId === summary.table.id}
                matchingUnitIds={matchingUnitIds}
                onOpenUnit={onOpenUnit}
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

          {/* Buckets share the room's coordinates but may sit outside it. */}
          <div
            className="absolute left-0 top-0 z-10 size-0 origin-top-left"
            style={{ transform: `translate(${origin.left}px, ${origin.top}px) scale(${zoom})` }}
          >
            {bucketSummaries.map((summary) => (
              <PlanBucket
                key={summary.bucket.id}
                draggingUnitId={draggingUnitId}
                highlighted={highlightedTableId === summary.bucket.id}
                isDropTarget={dropBucketId === summary.bucket.id}
                isMoving={draggingBucketId === summary.bucket.id}
                matchingUnitIds={matchingUnitIds}
                onMeasure={measureBucket}
                onOpenBucket={onOpenBucket}
                onOpenUnit={onOpenUnit}
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
  draggingUnitId: string | null;
  highlighted: boolean;
  isDropTarget: boolean;
  isMoving: boolean;
  matchingUnitIds: ReadonlySet<string> | null;
  onOpenUnit: (unitId: string) => void;
  onOpenTable: (tableId: string) => void;
  previewCount: number | undefined;
  roomHeight: number;
  roomWidth: number;
  seatedNumbers: ReadonlySet<number> | undefined;
  summary: TableSummary;
  zoom: number;
};

/** Smallest party-name font (room units) a crowded table may shrink to. */
const MIN_CHIP_FONT = 3;
/** Chip border plus the dashed headcount badge's border, in room units. */
const CHIP_FIXED_WIDTH = 4;

/**
 * Width of a table party chip per unit of font, mirroring PlanPartyChip:
 * 0.5em left padding, name, 0.3em gap, headcount badge, 0.15em right padding.
 */
function partyChipEm(unit: SeatingUnit, textVersion: number) {
  const badgeEm = Math.max(1.6, chipTextEm(partySeatsLabel(unit), textVersion, { bold: true }) + 0.8) * 0.8;

  return 0.5 + chipTextEm(unit.name, textVersion) + 0.3 + badgeEm + 0.15 + 0.1;
}

const PlanTable = memo(function PlanTable({
  detail,
  draggingUnitId,
  highlighted,
  isDropTarget,
  isMoving,
  matchingUnitIds,
  onOpenUnit,
  onOpenTable,
  previewCount,
  roomHeight,
  roomWidth,
  seatedNumbers,
  summary,
  zoom,
}: PlanTableProps) {
  const { table, units: parties } = summary;
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

  const matchCount = matchingUnitIds
    ? parties.filter((party) => matchingUnitIds.has(party.id)).length
    : 0;
  const dimmed = matchingUnitIds !== null && matchCount === 0;

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
  const borderWidth = Math.max(3, 2 / zoom);
  const headerHeight = round
    ? detail && labelIsNumber
      ? numberFont * 1.05 + (showName ? nameFont * 1.2 : 0) + 6
      : labelFont * 1.15 + countFont * 1.25 + 6
    : Math.max(nameFont, countFont) * 1.35 + 8;
  // Party names use the higher-x-height serif so they stay legible when small,
  // and shrink as people are added so every name at the table shows in full.
  const maxChipFont = Math.max(12, 10 / zoom);
  const textVersion = useChipTextVersion();
  const chipEms = useMemo(
    () => (detail ? parties.map((party) => partyChipEm(party, textVersion)) : []),
    [detail, parties, textVersion],
  );
  const chipLayout = useMemo(
    () =>
      layoutTableChips({
        chipEms,
        chipFixedWidth: CHIP_FIXED_WIDTH,
        headerHeight,
        maxFont: maxChipFont,
        minFont: MIN_CHIP_FONT,
        ...(round
          ? {
              shape: "round" as const,
              radius: size.width / 2 - borderWidth - size.width * 0.02,
              maxLineWidth: size.width - 2 * borderWidth - size.width * 0.1,
            }
          : {
              shape: "rect" as const,
              width: size.width - 2 * borderWidth - 28,
              height: size.height - 2 * borderWidth - 16,
            }),
      }),
    [borderWidth, chipEms, headerHeight, maxChipFont, round, size.height, size.width],
  );
  const chipFont = chipLayout.fontSize;
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
        <span className="mt-[3px] flex w-full flex-col items-center" style={{ gap: chipFont * CHIP_LINE_GAP_EM }}>
          {chipLayout.lines.map((line, lineIndex) => (
            <span
              key={lineIndex}
              className="flex max-w-full justify-center"
              style={{ gap: chipFont * CHIP_GAP_EM }}
            >
              {line.map((index) => {
                const party = parties[index];

                return (
                  <PlanPartyChip
                    key={party.id}
                    fontSize={chipFont}
                    isDragging={draggingUnitId === party.id}
                    isMatch={matchingUnitIds?.has(party.id) ?? false}
                    maxWidth={chipLayout.lineWidths[lineIndex]}
                    onOpenUnit={onOpenUnit}
                    unit={party}
                  />
                );
              })}
            </span>
          ))}
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
  onOpenUnit,
  unit: party,
  wrap = false,
}: {
  fontSize: number;
  isDragging: boolean;
  isMatch: boolean;
  maxWidth: number | string;
  onOpenUnit: (unitId: string) => void;
  unit: SeatingUnit;
  /** Let long names wrap instead of truncating (buckets never hide anyone). */
  wrap?: boolean;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `party-plan-${party.id}`,
    data: { type: "party", unitId: party.id } satisfies PartyDragData,
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
        "seating-chip seating-chip-plan flex min-w-0 cursor-grab items-center gap-[0.3em] border pl-[0.5em] pr-[0.15em] leading-[1.25] shadow-[0_1px_0_rgba(74,16,39,0.08)]",
        wrap ? "rounded-[0.55em]" : "rounded-full",
        partyCardClasses(party.status),
        unconfirmed && "italic",
        party.status === "no" && "line-through",
        isDragging && "opacity-30",
        isMatch && "ring-[3px] ring-[#ec4899]",
      )}
      data-no-pan
      onClick={(event) => {
        event.stopPropagation();
        onOpenUnit(party.id);
      }}
      onKeyDown={(event) => event.stopPropagation()}
      style={{ fontSize, maxWidth, paddingTop: fontSize * 0.06, paddingBottom: fontSize * 0.06 }}
    >
      <span className={clsx("min-w-0", wrap ? "break-words text-left" : "truncate")}>{party.name}</span>
      <PartySeatsBadge className="text-[0.8em] not-italic" party={party} />
    </button>
  );
}

type PlanBucketProps = {
  draggingUnitId: string | null;
  highlighted: boolean;
  isDropTarget: boolean;
  isMoving: boolean;
  matchingUnitIds: ReadonlySet<string> | null;
  onMeasure: (bucketId: string, width: number, height: number) => void;
  onOpenBucket: (bucketId: string) => void;
  onOpenUnit: (unitId: string) => void;
  summary: BucketSummary;
  zoom: number;
};

/**
 * A named holding area for people who aren't seated yet. It holds any number
 * of people, shows every one of them, and grows taller as more are added.
 * Bubbles (dropped on empty floor) render as just their people, hugged by a
 * soft outline, with no title.
 */
const PlanBucket = memo(function PlanBucket({
  draggingUnitId,
  highlighted,
  isDropTarget,
  isMoving,
  matchingUnitIds,
  onMeasure,
  onOpenBucket,
  onOpenUnit,
  summary,
  zoom,
}: PlanBucketProps) {
  const { bucket, units } = summary;
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const drag = useDraggable({
    id: `move-bucket-${bucket.id}`,
    data: { type: "bucket", bucketId: bucket.id } satisfies BucketDragData,
  });
  const drop = useDroppable({
    id: `plan-bucket-${bucket.id}`,
    data: { type: "bucket", bucketId: bucket.id, area: "plan" } satisfies DropData,
  });
  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      drag.setNodeRef(node);
      drop.setNodeRef(node);
    },
    // setNodeRef functions from dnd-kit are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Report the rendered size so the floor plan's scroll area covers it.
  useEffect(() => {
    const node = nodeRef.current;

    if (!node) {
      return;
    }

    const report = () => onMeasure(bucket.id, node.offsetWidth, node.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, [bucket.id, onMeasure]);

  let translateX = 0;
  let translateY = 0;
  if (drag.transform) {
    const next = clampBucketPosition(bucket.x + drag.transform.x / zoom, bucket.y + drag.transform.y / zoom);
    translateX = next.x - bucket.x;
    translateY = next.y - bucket.y;
  }

  const dimmed = matchingUnitIds !== null && !units.some((unit) => matchingUnitIds.has(unit.id));
  // Same legibility rule as table chips: grow text in room units as the room shrinks.
  const chipFont = bubbleChipFont(zoom);
  const titleFont = Math.max(15, 12 / zoom);
  // Wider when zoomed out so the bigger text still fits a name or two per row.
  const width = Math.max(BUCKET_WIDTH, Math.round(chipFont * 13));
  const borderWidth = Math.max(2, 1.5 / zoom);
  const ring = isDropTarget
    ? `0 0 0 ${Math.max(6, 5 / zoom)}px rgba(190, 24, 93, 0.55)`
    : highlighted
      ? `0 0 0 ${Math.max(5, 4 / zoom)}px rgba(236, 72, 153, 0.45)`
      : undefined;
  const shadow = isMoving
    ? `0 ${18 / zoom}px ${40 / zoom}px -${10 / zoom}px rgba(74, 16, 39, 0.55)`
    : `0 ${6 / zoom}px ${16 / zoom}px -${10 / zoom}px rgba(74, 16, 39, 0.35)`;

  const chips = units.map((unit) => (
    <PlanPartyChip
      key={unit.id}
      fontSize={chipFont}
      isDragging={draggingUnitId === unit.id}
      isMatch={matchingUnitIds?.has(unit.id) ?? false}
      maxWidth="100%"
      onOpenUnit={onOpenUnit}
      unit={unit}
      wrap
    />
  ));

  if (bucket.bubble) {
    // Just the people, in a soft bubble that hugs them. Click a name for options.
    return (
      <div
        ref={setNodeRef}
        {...drag.attributes}
        {...drag.listeners}
        aria-label={`Bubble on the floor: ${summary.count} not seated. Drag to move.`}
        className={clsx(
          "seating-bubble absolute flex w-max flex-wrap select-none rounded-[1.4em] border-dashed border-[#d58aab] bg-[#fff7fa]/90 outline-none",
          isMoving ? "z-30 cursor-grabbing" : "cursor-grab",
          dimmed && !isMoving && "opacity-30",
          "transition-[opacity,box-shadow] duration-150 focus-visible:ring-4 focus-visible:ring-[#be185d]/50",
        )}
        data-no-pan
        style={{
          left: bucket.x,
          top: bucket.y,
          // Room for a long name on one line, or two short ones side by side.
          maxWidth: Math.round(chipFont * 20),
          fontSize: chipFont,
          borderWidth: Math.max(1.5, 1.2 / zoom),
          boxShadow: [ring, shadow].filter(Boolean).join(", "),
          transform: `translate3d(${translateX}px, ${translateY}px, 0)`,
          padding: chipFont * 0.3,
          gap: chipFont * 0.3,
        }}
      >
        {chips}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...drag.attributes}
      {...drag.listeners}
      aria-label={`${bucketTitle(bucket)} bucket: ${summary.count} not seated. Drag to move; press Enter to edit.`}
      className={clsx(
        "seating-bucket absolute flex select-none flex-col rounded-[16px] border-dashed border-[#b2577f] bg-[#fff4f8]/95 text-[#4a1027] outline-none",
        isMoving ? "z-30 cursor-grabbing" : "cursor-grab",
        dimmed && !isMoving && "opacity-30",
        "transition-[opacity,box-shadow] duration-150 focus-visible:ring-4 focus-visible:ring-[#be185d]/50",
      )}
      data-no-pan
      onClick={() => onOpenBucket(bucket.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenBucket(bucket.id);
        }
      }}
      style={{
        left: bucket.x,
        top: bucket.y,
        width,
        borderWidth,
        boxShadow: [ring, shadow].filter(Boolean).join(", "),
        transform: `translate3d(${translateX}px, ${translateY}px, 0)`,
        padding: `${chipFont * 0.55}px ${chipFont * 0.6}px`,
        gap: chipFont * 0.45,
      }}
    >
      <span className="flex min-w-0 items-center gap-[0.35em] leading-tight" style={{ fontSize: titleFont }}>
        <Inbox aria-hidden="true" className="shrink-0 text-[#a04670]" size={titleFont} />
        <span className={clsx("min-w-0 flex-1 break-words font-semibold", !bucket.name && "italic text-[#a07088]")}>
          {bucketTitle(bucket)}
        </span>
        <span className="shrink-0 rounded-full border border-dashed border-[#a04670] bg-white px-[0.45em] text-[0.8em] font-bold tabular-nums text-[#7a1239]">
          {summary.count}
        </span>
      </span>
      {units.length > 0 ? (
        <span className="flex flex-wrap" style={{ gap: chipFont * 0.3 }}>
          {chips}
        </span>
      ) : (
        <span className="italic leading-snug text-[#8f5070]" style={{ fontSize: chipFont }}>
          Not seated yet. Drag people here.
        </span>
      )}
    </div>
  );
});

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
