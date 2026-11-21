"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import clsx from "clsx";
import {
  GripVertical,
  Hash,
  MapPin,
  Tag,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import { tableFullTitle, type SeatingTable } from "@/lib/seating";
import {
  labelConflict,
  parseLabelList,
  type LabelPlacement,
  type SeatingLabel,
  type SeatingLabelKind,
} from "@/lib/seating-labels";
import { Sheet } from "./seating-sheet";
import type { DropData, LabelDragData } from "./seating-ui";

const fieldClass =
  "w-full rounded-xl border border-[#df7fa3] bg-white px-3 py-2 text-base text-[#4a1027] outline-none focus:border-[#be185d] focus:ring-2 focus:ring-[#be185d]/20";

export function LabelChip({
  label,
  onOpen,
  context,
  isDragging,
  style,
  className,
}: {
  label: SeatingLabel;
  onOpen: (id: string) => void;
  context: string;
  isDragging?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `label-${context}-${label.id}`,
    data: { type: "label", labelId: label.id } satisfies LabelDragData,
  });
  const Icon = label.kind === "number" ? Hash : Tag;
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`Table ${label.kind}: ${label.value}. Drag to a table or the floor, or tap for options.`}
      data-no-pan
      className={clsx(
        "seating-chip flex min-w-0 cursor-grab items-center gap-1.5 rounded-lg border px-2 py-1 text-left font-semibold leading-tight shadow-sm",
        label.kind === "name"
          ? "border-[#83aa93] bg-[#edf6ee] text-[#24513e]"
          : "border-[#d79ab4] bg-[#fff1f7] text-[#7a1239]",
        isDragging && "opacity-30",
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(label.id);
      }}
      onKeyDown={(event) => event.stopPropagation()}
      style={style}
    >
      <Icon size="1em" aria-hidden="true" className="shrink-0 opacity-75" />
      <span className="min-w-0 break-words [overflow-wrap:anywhere]">
        {label.value}
      </span>
      <GripVertical
        size="0.85em"
        aria-hidden="true"
        className="ml-auto shrink-0 opacity-40"
      />
    </button>
  );
}

export function LabelWarning({
  labels,
  className,
  style,
  compact = false,
}: {
  compact?: boolean;
  labels: readonly SeatingLabel[];
  className?: string;
  style?: CSSProperties;
}) {
  const conflict = labelConflict(labels);
  return conflict ? (
    <span
      role="status"
      title="Keep one name and one number per table. Drag extra labels away to resolve."
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[#dc2626] bg-[#fef2f2] px-2 py-0.5 text-xs font-bold text-[#b91c1c]",
        className,
      )}
      style={style}
    >
      <TriangleAlert size="1em" aria-hidden="true" />
      <span className={compact ? "sr-only" : undefined}>{conflict}</span>
    </span>
  ) : null;
}

export function LabelList({
  kind,
  labels,
  tables,
  onAdd,
  onOpen,
  draggingLabelId,
  compact = false,
}: {
  kind: SeatingLabelKind;
  labels: SeatingLabel[];
  tables: SeatingTable[];
  onAdd: (kind: SeatingLabelKind, values: string[]) => void;
  onOpen: (id: string) => void;
  draggingLabelId: string | null;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const { setNodeRef, isOver } = useDroppable({
    id: `label-list-${compact ? "tray" : "sidebar"}-${kind}`,
    data: { type: "label-list", kind, area: "list" } satisfies DropData,
  });
  const items = labels.filter((label) => label.kind === kind);
  const addForm = (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = parseLabelList(draft, kind);
        setError(parsed.error);
        if (parsed.values.length) {
          onAdd(kind, parsed.values);
          setDraft("");
        }
      }}
      className="mb-4 flex flex-col gap-2"
    >
      <label className="text-sm font-semibold">
        {kind === "name" ? "Table names" : "Table numbers"}
        <textarea
          aria-label={`New table ${kind}s, one per line`}
          rows={compact ? 2 : 3}
          className={clsx(fieldClass, "mt-1 block resize-y")}
          placeholder={
            kind === "name" ? "Kyoto\nParis\nNew York" : "1\n2A\nHead table"
          }
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-[#b91c1c]">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[#8f5070]">
          One per line · {kind === "number" ? 12 : 40} characters each
        </span>
        <button
          type="submit"
          disabled={!draft.trim()}
          className="min-h-10 shrink-0 rounded-full bg-[#9f1d52] px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          Add {kind}s
        </button>
      </div>
    </form>
  );
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain p-3",
        isOver && "bg-[#ffd8e8]",
      )}
      data-seating-clip
    >
      {!compact ? (
        <p className="mb-3 text-sm text-[#8f5070]">
          Make your list, then drag labels onto tables or anywhere on the floor.
          Tap a label to edit or assign it.
        </p>
      ) : null}
      {compact ? (
        <details className="mb-3" open={items.length === 0 || undefined}>
          <summary className="min-h-9 cursor-pointer text-sm font-semibold text-[#7a1239]">
            Add {kind}s
          </summary>
          {addForm}
        </details>
      ) : (
        addForm
      )}
      <div className={clsx("grid gap-2", compact && "grid-cols-2")}>
        {items.map((label) => {
          const table = tables.find((table) => table.id === label.tableId);
          return (
            <div key={label.id} className="min-w-0">
              <LabelChip
                context={compact ? "tray" : "list"}
                label={label}
                onOpen={onOpen}
                isDragging={draggingLabelId === label.id}
                className="min-h-11 w-full text-base"
              />
              <p className="mt-0.5 px-1 text-xs text-[#8f5070]">
                {table
                  ? tableFullTitle(table)
                  : label.x !== null
                    ? "On the floor"
                    : "Unassigned"}
              </p>
            </div>
          );
        })}
      </div>
      {!items.length ? (
        <p className="py-4 text-center text-sm text-[#8f5070]">
          No {kind}s yet. Add a few above.
        </p>
      ) : null}
      {isOver ? (
        <p className="mt-3 text-sm font-semibold text-[#7a1239]">
          Drop to return this label to its list.
        </p>
      ) : null}
    </div>
  );
}

export function LabelDialog({
  label,
  tables,
  onClose,
  onEdit,
  onPlace,
  onDelete,
  onLocate,
}: {
  label: SeatingLabel;
  tables: SeatingTable[];
  onClose: () => void;
  onEdit: (value: string) => void;
  onPlace: (placement: LabelPlacement) => void;
  onDelete: () => void;
  onLocate: () => void;
}) {
  const [value, setValue] = useState(label.value);
  const table = tables.find((table) => table.id === label.tableId);
  function save() {
    if (value.trim() && value.trim() !== label.value) onEdit(value.trim());
  }
  return (
    <Sheet
      title={`Table ${label.kind}`}
      description="Drag this label between tables, or leave it anywhere on the floor."
      onClose={() => {
        save();
        onClose();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
          onClose();
        }}
      >
        <label className="grid gap-1 text-sm font-semibold">
          {label.kind === "name" ? "Name" : "Number"}
          <input
            autoFocus
            className={fieldClass}
            maxLength={label.kind === "number" ? 12 : 40}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={save}
          />
        </label>
        <p className="mt-3 text-sm text-[#8f5070]">
          {table
            ? `Assigned to ${tableFullTitle(table)}`
            : label.x !== null
              ? "Staged on the floor"
              : "In the unassigned list"}
        </p>
        {label.x !== null || label.tableId ? (
          <button
            type="button"
            className="mt-2 flex min-h-11 items-center gap-2 text-sm font-semibold text-[#7a1239]"
            onClick={onLocate}
          >
            <MapPin size={16} /> Show on floor plan
          </button>
        ) : null}
        <label className="mt-4 grid gap-1 text-sm font-semibold">
          Assign to a table
          <select
            className={fieldClass}
            value={label.tableId ?? ""}
            onChange={(event) => {
              save();
              onPlace({
                tableId: event.target.value || null,
                x: null,
                y: null,
              });
              onClose();
            }}
          >
            <option value="">Unassigned</option>
            {tables.map((table, index) => (
              <option key={table.id} value={table.id}>
                {tableFullTitle(table)}
                {!table.number && !table.name ? ` (${index + 1})` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!value.trim()}
            className="min-h-11 rounded-full bg-[#9f1d52] px-5 font-semibold text-white disabled:opacity-40"
          >
            Done
          </button>
          {label.tableId || label.x !== null ? (
            <button
              type="button"
              className="min-h-11 rounded-full border border-[#df7fa3] px-4 text-sm font-semibold"
              onClick={() => {
                save();
                onPlace({ tableId: null, x: null, y: null });
                onClose();
              }}
            >
              Return to list
            </button>
          ) : null}
          <button
            type="button"
            className="ml-auto flex min-h-11 items-center gap-1 text-sm font-semibold text-[#b91c1c]"
            onClick={onDelete}
          >
            <Trash2 size={16} /> Delete label
          </button>
        </div>
      </form>
    </Sheet>
  );
}
