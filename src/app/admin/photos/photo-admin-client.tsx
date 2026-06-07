"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical } from "lucide-react";
import Image from "next/image";
import { useMemo, useRef, useState, useTransition } from "react";
import type { AdminWeddingPhoto } from "@/lib/photos";
import { reorderPhotoRows, setPhotoHidden } from "./actions";

type PhotoAdminClientProps = {
  photos: AdminWeddingPhoto[];
};

type SortablePhotoCardProps = {
  isFirst: boolean;
  isLast: boolean;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onToggleHidden: () => void;
  photo: AdminWeddingPhoto;
  position: number;
  toggling: boolean;
};

function SortablePhotoCard({
  isFirst,
  isLast,
  onMoveDown,
  onMoveUp,
  onToggleHidden,
  photo,
  position,
  toggling,
}: SortablePhotoCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.filename });
  const isHidden = Boolean(photo.hiddenAt);

  return (
    <article
      ref={setNodeRef}
      className={clsx(
        "grid gap-1.5 border bg-[#fff8fb] p-1.5 shadow-[0_14px_28px_-24px_rgba(143,36,72,0.85)] sm:gap-2 sm:p-2",
        isDragging ? "relative z-20 border-[#be185d] opacity-90" : "border-[#df7fa3]",
        isHidden && "bg-[#f7d8e4] opacity-70",
      )}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div className="relative aspect-[4/5] overflow-hidden border border-[#efb5c9] bg-[#f4bfd2]">
        <Image
          alt={photo.alt}
          className={clsx("object-cover", isHidden && "grayscale")}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 180px"
          src={photo.src}
        />
        <div className="absolute left-2 top-2 rounded-sm border border-[#df7fa3] bg-[#fff8fb]/95 px-2 py-1 text-xs font-bold tabular-nums text-[#7a1239]">
          {position}
        </div>
        {isHidden ? (
          <div className="absolute bottom-2 left-2 rounded-sm border border-[#7a1239] bg-[#4a1027]/90 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#ffd6e4]">
            Hidden
          </div>
        ) : null}
      </div>
      <div className="grid gap-1.5 sm:gap-2">
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-1">
          <button
            type="button"
            className="grid size-8 cursor-grab place-items-center border border-[#df7fa3] bg-[#fff1f7] text-[#7a1239] transition hover:border-[#be185d] hover:bg-[#f4bfd2] sm:size-9"
            title="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} aria-hidden="true" />
            <span className="sr-only">Drag {photo.alt}</span>
          </button>
          <button
            type="button"
            className="inline-flex h-8 min-w-0 items-center justify-center gap-1 border border-[#df7fa3] bg-[#fff1f7] px-1.5 text-[0.7rem] font-semibold text-[#7a1239] transition hover:border-[#be185d] hover:bg-[#f4bfd2] disabled:cursor-not-allowed disabled:opacity-45 sm:h-9 sm:px-2 sm:text-xs"
            onClick={onToggleHidden}
            disabled={toggling}
          >
            {isHidden ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
            {isHidden ? "Show" : "Hide"}
          </button>
          <button
            type="button"
            className="grid size-8 place-items-center border border-[#df7fa3] bg-[#fff1f7] text-[#7a1239] transition hover:border-[#be185d] hover:bg-[#f4bfd2] disabled:cursor-not-allowed disabled:opacity-45 sm:size-9"
            onClick={onMoveUp}
            disabled={isFirst}
            title="Move up"
          >
            <ArrowUp size={15} aria-hidden="true" />
            <span className="sr-only">Move {photo.alt} up</span>
          </button>
          <button
            type="button"
            className="grid size-8 place-items-center border border-[#df7fa3] bg-[#fff1f7] text-[#7a1239] transition hover:border-[#be185d] hover:bg-[#f4bfd2] disabled:cursor-not-allowed disabled:opacity-45 sm:size-9"
            onClick={onMoveDown}
            disabled={isLast}
            title="Move down"
          >
            <ArrowDown size={15} aria-hidden="true" />
            <span className="sr-only">Move {photo.alt} down</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export function PhotoAdminClient({ photos }: PhotoAdminClientProps) {
  const [orderedPhotos, setOrderedPhotos] = useState(photos);
  const [message, setMessage] = useState("Drag photos or use the arrow buttons. Changes autosave.");
  const [isOrderSaving, setIsOrderSaving] = useState(false);
  const [pendingFilename, setPendingFilename] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const orderSaveRef = useRef<{ queuedFilenames: string[] | null; saving: boolean }>({
    queuedFilenames: null,
    saving: false,
  });
  const visibleCount = useMemo(
    () => orderedPhotos.filter((photo) => !photo.hiddenAt).length,
    [orderedPhotos],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function saveOrderLoop(initialFilenames: string[]) {
    orderSaveRef.current.saving = true;
    setIsOrderSaving(true);
    setMessage("Saving photo order...");

    let filenamesToSave: string[] | null = initialFilenames;
    let latestResult = await reorderPhotoRows(filenamesToSave);

    while (orderSaveRef.current.queuedFilenames) {
      filenamesToSave = orderSaveRef.current.queuedFilenames;
      orderSaveRef.current.queuedFilenames = null;
      latestResult = await reorderPhotoRows(filenamesToSave);
    }

    orderSaveRef.current.saving = false;
    setIsOrderSaving(false);
    setMessage(latestResult.message);
  }

  function autosaveOrder(nextPhotos: AdminWeddingPhoto[]) {
    const filenames = nextPhotos.map((photo) => photo.filename);

    if (orderSaveRef.current.saving) {
      orderSaveRef.current.queuedFilenames = filenames;
      setMessage("Saving photo order...");
      return;
    }

    void saveOrderLoop(filenames);
  }

  function movePhoto(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= orderedPhotos.length) {
      return;
    }

    const nextPhotos = arrayMove(orderedPhotos, fromIndex, toIndex);
    setOrderedPhotos(nextPhotos);
    autosaveOrder(nextPhotos);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = orderedPhotos.findIndex((photo) => photo.filename === active.id);
    const newIndex = orderedPhotos.findIndex((photo) => photo.filename === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    movePhoto(oldIndex, newIndex);
  }

  function handleToggleHidden(photo: AdminWeddingPhoto) {
    const nextHidden = !photo.hiddenAt;

    setPendingFilename(photo.filename);
    startTransition(async () => {
      try {
        const result = await setPhotoHidden(photo.filename, nextHidden);
        setMessage(result.message);

        if (!result.ok) {
          return;
        }

        setOrderedPhotos((current) =>
          current.map((item) =>
            item.filename === photo.filename
              ? { ...item, hiddenAt: nextHidden ? new Date().toISOString() : null }
              : item,
          ),
        );
      } finally {
        setPendingFilename(null);
      }
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 border-b border-[#df7fa3] bg-[#f4bfd2] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p
            className="text-xl leading-none text-[#be185d]"
            style={{ fontFamily: "var(--font-brand-script)", fontWeight: 400 }}
          >
            Sean + Lexi = Sexi
          </p>
          <h1 className="mt-1 text-xl font-semibold leading-none text-[#7a1239]">
            Edit Photos
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#7a1239]">
          <span className="border border-[#df7fa3] bg-[#fff8fb] px-2 py-1 tabular-nums">
            {visibleCount} visible
          </span>
          <span className="border border-[#df7fa3] bg-[#fff8fb] px-2 py-1 tabular-nums">
            {orderedPhotos.length - visibleCount} hidden
          </span>
        </div>
      </div>
      <div className="px-3">
        <p className="min-h-6 text-sm font-semibold text-[#8f2448]" role="status">
          {isPending || isOrderSaving ? "Saving..." : message}
        </p>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={orderedPhotos.map((photo) => photo.filename)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 gap-3 px-3 pb-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {orderedPhotos.map((photo, index) => (
              <SortablePhotoCard
                key={photo.filename}
                isFirst={index === 0}
                isLast={index === orderedPhotos.length - 1}
                onMoveDown={() => movePhoto(index, index + 1)}
                onMoveUp={() => movePhoto(index, index - 1)}
                onToggleHidden={() => handleToggleHidden(photo)}
                photo={photo}
                position={index + 1}
                toggling={pendingFilename === photo.filename}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
