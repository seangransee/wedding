"use client";

import clsx from "clsx";
import { Check, GripVertical } from "lucide-react";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  DataGrid,
  type CellClickArgs,
  type CellMouseEvent,
  type Column,
  type RenderCellProps,
  type RenderEditCellProps,
  type RowsChangeData,
  type SortColumn,
} from "react-data-grid";
import type { GuestWithRsvp } from "@/lib/db";
import { slugify } from "@/lib/slug";
import {
  addGuest,
  deleteGuest,
  editGuestCount,
  editGuestName,
  editGuestNotes,
  editGuestSlug,
  loginAdmin,
  reorderGuestRows,
  setInviteSent,
  type AdminActionState,
} from "./actions";

const initialState: AdminActionState = {
  ok: false,
  message: "",
};

export type AdminSortKey = "default" | "name" | "max" | "invite" | "rsvp" | "attending";
export type AdminSortDirection = "asc" | "desc";

type EditableColumnKey = "name" | "slug" | "notes" | "guestCount";

const SORT_KEY_TO_COLUMN_KEY: Record<Exclude<AdminSortKey, "default">, string> = {
  name: "name",
  max: "guestCount",
  invite: "inviteSent",
  rsvp: "rsvpStatus",
  attending: "attendingCount",
};

const COLUMN_KEY_TO_SORT_KEY: Record<string, Exclude<AdminSortKey, "default">> = {
  name: "name",
  guestCount: "max",
  inviteSent: "invite",
  rsvpStatus: "rsvp",
  attendingCount: "attending",
};

function rsvpLabel(status: string | null) {
  if (status === "yes") {
    return "Yes";
  }
  if (status === "no") {
    return "No";
  }
  if (status === "deciding") {
    return "Still deciding";
  }
  return "No response";
}

function rsvpClassName(status: string | null) {
  if (status === "yes") {
    return "border-[#d65b8a] bg-[#ffe0ec] text-[#7a1239]";
  }
  if (status === "no") {
    return "border-[#b85d73] bg-[#f8d5dd] text-[#701a32]";
  }
  if (status === "deciding") {
    return "border-[#d78a3d] bg-[#ffe6c8] text-[#8a4a0f]";
  }
  return "border-[#e7a1ba] bg-[#fff1f7] text-[#7d3150]";
}

function SubmitButton({
  children,
  disabled = false,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex min-h-8 items-center justify-center rounded border border-[#7a1239] bg-[#9f1d52] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#fff8fb] transition hover:bg-[#bd2867] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving..." : children}
    </button>
  );
}

export function AdminLoginForm() {
  const [state, formAction] = useActionState(loginAdmin, initialState);

  return (
    <form action={formAction} className="mx-auto grid w-full max-w-sm gap-4">
      <label className="grid gap-2 text-left text-sm font-semibold uppercase tracking-[0.18em] text-[#8f2448]">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="min-h-12 rounded-md border border-[#df7fa3] bg-[#fff8fb]/90 px-4 text-base normal-case tracking-normal text-[#4a1027] outline-none transition focus:border-[#be185d] focus:ring-2 focus:ring-[#be185d]/20"
        />
      </label>
      <SubmitButton>Enter admin</SubmitButton>
      {state.message ? (
        <p className="text-sm font-semibold text-[#8f2448]" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function AddGuestForm() {
  const [state, formAction] = useActionState(addGuest, initialState);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(name));
    }
  }, [name, slugTouched]);

  const canAddGuest = Boolean(name.trim() && slug);

  return (
    <form action={formAction} className="border-b border-[#df7fa3] bg-[#fff1f7]">
      <div className="grid grid-cols-1 border-b border-[#efb5c9] md:grid-cols-[minmax(12rem,1fr)_minmax(12rem,0.95fr)_5.5rem_minmax(14rem,1fr)_minmax(12rem,0.85fr)_7rem]">
        <label className="grid gap-1 border-b border-[#efb5c9] px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#8f2448] md:border-r md:border-b-0">
          Name
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-h-9 border border-[#df7fa3] bg-[#fff8fb] px-2 text-base font-normal normal-case tracking-normal text-[#4a1027] outline-none transition placeholder:text-[#4a1027]/35 focus:border-[#be185d] focus:ring-1 focus:ring-[#be185d]/30 md:min-h-7 md:text-sm"
          />
        </label>
        <label className="grid gap-1 border-b border-[#efb5c9] px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#8f2448] md:border-r md:border-b-0">
          Slug
          <input
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            className="min-h-9 border border-[#df7fa3] bg-[#fff8fb] px-2 text-base font-normal normal-case tracking-normal text-[#4a1027] outline-none transition placeholder:text-[#4a1027]/35 focus:border-[#be185d] focus:ring-1 focus:ring-[#be185d]/30 md:min-h-7 md:text-sm"
          />
        </label>
        <label className="grid gap-1 border-b border-[#efb5c9] px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#8f2448] md:border-r md:border-b-0">
          Guests
          <input
            name="guestCount"
            type="number"
            min="1"
            max="10"
            defaultValue="2"
            className="min-h-9 border border-[#df7fa3] bg-[#fff8fb] px-2 text-base font-normal normal-case tracking-normal text-[#4a1027] outline-none transition focus:border-[#be185d] focus:ring-1 focus:ring-[#be185d]/30 md:min-h-7 md:text-sm"
          />
        </label>
        <label className="grid gap-1 border-b border-[#efb5c9] px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#8f2448] md:border-r md:border-b-0">
          Notes
          <input
            name="notes"
            className="min-h-9 border border-[#df7fa3] bg-[#fff8fb] px-2 text-base font-normal normal-case tracking-normal text-[#4a1027] outline-none transition placeholder:text-[#4a1027]/35 focus:border-[#be185d] focus:ring-1 focus:ring-[#be185d]/30 md:min-h-7 md:text-sm"
          />
        </label>
        <div className="border-b border-[#efb5c9] px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#8f2448] md:border-r md:border-b-0">
          Preview
          <p className="mt-1 truncate font-mono text-xs font-normal normal-case tracking-normal text-[#be185d]">
            https://sexiwedding.com/{slug}
          </p>
        </div>
        <div className="flex items-end px-2 py-1.5">
          <SubmitButton disabled={!canAddGuest}>Add row</SubmitButton>
        </div>
      </div>
      {state.message ? (
        <p
          className={`px-2 py-1 text-xs font-semibold ${state.ok ? "text-[#8f2448]" : "text-[#be123c]"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function DeleteSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="min-h-8 border border-[#7f1d1d] bg-[#be123c] px-3 text-xs font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-[#9f1239] disabled:cursor-not-allowed disabled:border-[#e7a1ba] disabled:bg-[#f8d5dd] disabled:text-[#9d6a7a]"
    >
      {pending ? "Deleting..." : "Delete guest"}
    </button>
  );
}

export function DeleteGuestButton({ guestId, guestName }: { guestId: number; guestName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction] = useActionState(deleteGuest, initialState);

  function closeDialog() {
    setOpen(false);
    setConfirmation("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-7 border border-[#e7a1ba] bg-[#fff1f7] px-2 font-semibold text-[#be123c] transition hover:border-[#be123c] hover:bg-[#ffe0ec]"
      >
        Delete
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#4a1027]/35 px-4">
          <form
            action={formAction}
            className="w-full max-w-md border border-[#be123c] bg-[#fff8fb] shadow-[0_24px_70px_-34px_rgba(143,36,72,0.8)]"
          >
            <input type="hidden" name="guestId" value={guestId} />
            <div className="border-b border-[#efb5c9] bg-[#ffe0ec] px-3 py-2">
              <h2 className="text-sm font-semibold text-[#7f1d1d]">Confirm guest deletion</h2>
            </div>
            <div className="grid gap-3 px-3 py-3 text-sm text-[#4a1027]">
              <p>
                Delete <span className="font-semibold text-[#7f1d1d]">{guestName}</span> and
                any RSVP/place-card rows for this guest.
              </p>
              <label className="grid gap-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#be123c]">
                Type delete
                <input
                  name="confirmation"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoFocus
                  className="min-h-8 border border-[#df7fa3] bg-white px-2 text-sm font-normal normal-case tracking-normal text-[#4a1027] outline-none focus:border-[#be123c] focus:ring-1 focus:ring-[#be123c]/25"
                />
              </label>
              {state.message ? (
                <p
                  className={`text-xs font-semibold ${state.ok ? "text-[#8f2448]" : "text-[#be123c]"}`}
                  role="status"
                >
                  {state.message}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#efb5c9] px-3 py-2">
              <button
                type="button"
                onClick={closeDialog}
                className="min-h-8 border border-[#df7fa3] bg-white px-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#8f2448] transition hover:bg-[#fff1f7]"
              >
                Cancel
              </button>
              <DeleteSubmitButton disabled={confirmation !== "delete"} />
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export function InviteSentToggle({
  guestId,
  inviteSent,
}: {
  guestId: number;
  inviteSent: boolean;
}) {
  const [state, formAction] = useActionState(setInviteSent, initialState);

  return (
    <form action={formAction} className="flex items-center justify-center">
      <input type="hidden" name="guestId" value={guestId} />
      <input type="hidden" name="inviteSent" value={inviteSent ? "false" : "true"} />
      <InviteSentSubmitButton checked={inviteSent} message={state.message} />
    </form>
  );
}

function InviteSentSubmitButton({ checked, message }: { checked: boolean; message: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={checked ? "Mark invite not sent" : "Mark invite sent"}
      title={message || (checked ? "Invite sent" : "Invite not sent")}
      className={clsx(
        "grid size-6 place-items-center border transition disabled:cursor-wait disabled:opacity-65",
        checked
          ? "border-[#d65b8a] bg-[#ffe0ec] text-[#7a1239] hover:bg-[#ffd4e5]"
          : "border-[#df7fa3] bg-white text-transparent hover:border-[#be185d] hover:bg-[#fff1f7]",
      )}
    >
      <Check aria-hidden="true" className="size-3.5 stroke-[3]" />
    </button>
  );
}

function rowKeyGetter(row: GuestWithRsvp) {
  return row.id;
}

function moveRow<T>(rows: T[], fromIndex: number, toIndex: number) {
  const nextRows = [...rows];
  const [movedRow] = nextRows.splice(fromIndex, 1);

  if (movedRow === undefined) {
    return rows;
  }

  nextRows.splice(toIndex, 0, movedRow);
  return nextRows;
}

function SpreadsheetTextEditor({
  row,
  column,
  onRowChange,
  onClose,
}: RenderEditCellProps<GuestWithRsvp>) {
  const key = column.key as EditableColumnKey;
  const [value, setValue] = useState(String(row[key] ?? ""));

  function commit() {
    const nextValue = key === "slug" ? slugify(value) : value;
    onRowChange({ ...row, [key]: nextValue }, true);
  }

  return (
    <input
      autoFocus
      value={value}
      onBlur={commit}
      onChange={(event) => setValue(key === "slug" ? slugify(event.target.value) : event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }

        if (event.key === "Escape") {
          event.preventDefault();
          onClose(false, true);
        }
      }}
      className="h-full w-full border-0 bg-white px-2 text-base text-[#4a1027] outline-none md:text-xs"
    />
  );
}

function SpreadsheetNumberEditor({
  row,
  column,
  onRowChange,
  onClose,
}: RenderEditCellProps<GuestWithRsvp>) {
  const [value, setValue] = useState(String(row.guestCount));

  function commit() {
    const numericValue = Number(value);

    if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 10) {
      onClose(false, true);
      return;
    }

    onRowChange({ ...row, [column.key]: numericValue }, true);
  }

  return (
    <input
      autoFocus
      inputMode="numeric"
      type="number"
      min="1"
      max="10"
      value={value}
      onBlur={commit}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }

        if (event.key === "Escape") {
          event.preventDefault();
          onClose(false, true);
        }
      }}
      className="h-full w-full border-0 bg-white px-2 text-left font-mono text-base tabular-nums text-[#4a1027] outline-none md:text-xs"
    />
  );
}

function SlugCell({ row }: RenderCellProps<GuestWithRsvp>) {
  return <span className="font-mono text-[#be185d]">/{row.slug}</span>;
}

function RsvpCell({ row }: RenderCellProps<GuestWithRsvp>) {
  return (
    <span
      className={`inline-flex min-w-24 justify-center border px-1.5 py-0.5 font-semibold ${rsvpClassName(row.rsvpStatus)}`}
    >
      {rsvpLabel(row.rsvpStatus)}
    </span>
  );
}

function PlaceCardsCell({ row }: RenderCellProps<GuestWithRsvp>) {
  return row.attendeeNames.length > 0 ? row.attendeeNames.join("; ") : "";
}

function ActionsCell({ row }: RenderCellProps<GuestWithRsvp>) {
  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={`/${row.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="min-h-7 border border-[#d65b8a] bg-[#fff1f7] px-2 py-1 font-semibold text-[#8f2448] transition hover:border-[#be185d] hover:bg-[#ffe0ec]"
      >
        View invitation
      </Link>
      <DeleteGuestButton guestId={row.id} guestName={row.name} />
    </div>
  );
}

function InviteCell({ row }: RenderCellProps<GuestWithRsvp>) {
  return <InviteSentToggle guestId={row.id} inviteSent={row.inviteSent} />;
}

function makeFormData(values: Record<string, string | number | boolean>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, String(value));
  }

  return formData;
}

async function saveCellChange(
  previousRow: GuestWithRsvp,
  nextRow: GuestWithRsvp,
  columnKey: string,
) {
  if (columnKey === "name") {
    return editGuestName(initialState, makeFormData({
      guestId: previousRow.id,
      slug: previousRow.slug,
      name: nextRow.name,
    }));
  }

  if (columnKey === "slug") {
    return editGuestSlug(initialState, makeFormData({
      guestId: previousRow.id,
      oldSlug: previousRow.slug,
      slug: nextRow.slug,
    }));
  }

  if (columnKey === "notes") {
    return editGuestNotes(initialState, makeFormData({
      guestId: previousRow.id,
      notes: nextRow.notes,
    }));
  }

  if (columnKey === "guestCount") {
    return editGuestCount(initialState, makeFormData({
      guestId: previousRow.id,
      slug: previousRow.slug,
      guestCount: nextRow.guestCount,
    }));
  }

  return { ok: true, message: "" };
}

export function GuestTable({
  activeDirection,
  activeSortKey,
  guests,
  isDefaultSort,
}: {
  activeDirection: AdminSortDirection;
  activeSortKey: AdminSortKey;
  guests: GuestWithRsvp[];
  isDefaultSort: boolean;
}) {
  const [rows, setRows] = useState(guests);
  const [draggedGuestId, setDraggedGuestId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isSaving, startTransition] = useTransition();

  useEffect(() => {
    setRows(guests);
  }, [guests]);

  const sortColumns = useMemo<SortColumn[]>(() => {
    if (activeSortKey === "default") {
      return [];
    }

    return [{
      columnKey: SORT_KEY_TO_COLUMN_KEY[activeSortKey],
      direction: activeDirection === "asc" ? "ASC" : "DESC",
    }];
  }, [activeDirection, activeSortKey]);

  const handleRowDrop = useCallback((targetGuestId: number) => {
    if (!isDefaultSort || draggedGuestId === null || draggedGuestId === targetGuestId) {
      return;
    }

    const fromIndex = rows.findIndex((guest) => guest.id === draggedGuestId);
    const toIndex = rows.findIndex((guest) => guest.id === targetGuestId);

    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    const nextRows = moveRow(rows, fromIndex, toIndex);
    const previousRows = rows;

    setRows(nextRows);
    setMessage("Saving row order...");

    startTransition(() => {
      void reorderGuestRows(nextRows.map((guest) => guest.id))
        .then((result) => {
          setMessage(result.message);

          if (!result.ok) {
            setRows(previousRows);
          }
        })
        .catch(() => {
          setRows(previousRows);
          setMessage("Row order could not be saved.");
        });
    });
  }, [draggedGuestId, isDefaultSort, rows]);

  const columns = useMemo<Column<GuestWithRsvp>[]>(() => [
    {
      key: "rowNumber",
      name: "",
      width: 42,
      minWidth: 38,
      resizable: true,
      frozen: true,
      renderCell({ row, rowIdx }) {
        return (
          <div
            className="flex h-full items-center justify-center"
            onDragOver={(event) => {
              if (isDefaultSort && draggedGuestId !== null) {
                event.preventDefault();
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleRowDrop(row.id);
              setDraggedGuestId(null);
            }}
          >
            {isDefaultSort ? (
              <button
                type="button"
                draggable={!isSaving}
                aria-label={`Drag row ${rowIdx + 1}`}
                title="Drag to reorder"
                onDragStart={(event) => {
                  setDraggedGuestId(row.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(row.id));
                }}
                onDragEnd={() => setDraggedGuestId(null)}
                className="admin-row-handle"
              >
                <GripVertical aria-hidden="true" className="size-4" />
              </button>
            ) : (
              <span className="font-mono text-[0.7rem] tabular-nums text-[#8f5070]">{rowIdx + 1}</span>
            )}
          </div>
        );
      },
    },
    {
      key: "name",
      name: "Name",
      width: 210,
      minWidth: 150,
      sortable: true,
      resizable: true,
      editable: true,
      renderEditCell: SpreadsheetTextEditor,
      renderCell({ row }) {
        return <span className="font-semibold text-[#4a1027]">{row.name}</span>;
      },
    },
    {
      key: "slug",
      name: "URL",
      width: 190,
      minWidth: 140,
      resizable: true,
      editable: true,
      renderEditCell: SpreadsheetTextEditor,
      renderCell: SlugCell,
    },
    {
      key: "notes",
      name: "Notes",
      width: 220,
      minWidth: 150,
      resizable: true,
      editable: true,
      renderEditCell: SpreadsheetTextEditor,
    },
    {
      key: "guestCount",
      name: "Max",
      width: 76,
      minWidth: 64,
      sortable: true,
      resizable: true,
      editable: true,
      renderEditCell: SpreadsheetNumberEditor,
    },
    {
      key: "inviteSent",
      name: "Invite sent",
      width: 104,
      minWidth: 88,
      sortable: true,
      resizable: true,
      renderCell: InviteCell,
    },
    {
      key: "rsvpStatus",
      name: "RSVP",
      width: 140,
      minWidth: 116,
      sortable: true,
      resizable: true,
      renderCell: RsvpCell,
    },
    {
      key: "attendingCount",
      name: "Attending",
      width: 96,
      minWidth: 84,
      sortable: true,
      resizable: true,
      cellClass: "rdg-cell-right",
      renderCell({ row }) {
        return row.attendingCount ?? "";
      },
    },
    {
      key: "attendeeNames",
      name: "Place cards",
      width: 260,
      minWidth: 170,
      resizable: true,
      renderCell: PlaceCardsCell,
    },
    {
      key: "actions",
      name: "Actions",
      width: 190,
      minWidth: 170,
      resizable: true,
      renderCell: ActionsCell,
    },
  ], [draggedGuestId, handleRowDrop, isDefaultSort, isSaving]);

  function handleRowsChange(
    nextRows: GuestWithRsvp[],
    { indexes, column }: RowsChangeData<GuestWithRsvp>,
  ) {
    const previousRows = rows;
    setRows(nextRows);

    startTransition(() => {
      void Promise.all(
        indexes.map(async (rowIndex) => {
          const previousRow = previousRows[rowIndex];
          const nextRow = nextRows[rowIndex];

          if (!previousRow || !nextRow) {
            return { ok: false, message: "Row changed before it could be saved." };
          }

          return saveCellChange(previousRow, nextRow, column.key);
        }),
      ).then((results) => {
        const failedResult = results.find((result) => !result.ok);

        if (failedResult) {
          setRows(previousRows);
          setMessage(failedResult.message);
          return;
        }

        const successMessage = results.find((result) => result.message)?.message;
        setMessage(successMessage ?? "Cell saved.");
      }).catch(() => {
        setRows(previousRows);
        setMessage("Cell could not be saved.");
      });
    });
  }

  function handleSortColumnsChange(nextSortColumns: SortColumn[]) {
    const sortColumn = nextSortColumns[0];

    if (!sortColumn) {
      window.location.href = "/admin";
      return;
    }

    const sortKey = COLUMN_KEY_TO_SORT_KEY[sortColumn.columnKey];

    if (!sortKey) {
      return;
    }

    window.location.href = `/admin?sort=${sortKey}&dir=${sortColumn.direction === "DESC" ? "desc" : "asc"}`;
  }

  function handleCellClick(
    args: CellClickArgs<GuestWithRsvp>,
    event: CellMouseEvent,
  ) {
    if (args.column.editable) {
      args.selectCell(true);
      event.preventGridDefault();
    }
  }

  return (
    <div className="admin-spreadsheet-shell">
      <DataGrid
        aria-label="Guest RSVP spreadsheet"
        className="rdg-light admin-spreadsheet"
        columns={columns}
        rows={rows}
        rowKeyGetter={rowKeyGetter}
        onRowsChange={handleRowsChange}
        sortColumns={sortColumns}
        onSortColumnsChange={handleSortColumnsChange}
        onCellClick={handleCellClick}
        defaultColumnOptions={{ resizable: true }}
        rowHeight={42}
        headerRowHeight={34}
        enableVirtualization={false}
        renderers={{
          noRowsFallback: (
            <div className="grid h-full place-items-center px-3 py-8 text-sm text-[#8f5070]">
              No guests have been added yet.
            </div>
          ),
        }}
      />
      <div className="flex min-h-7 items-center border-t border-[#df7fa3] bg-[#fff1f7] px-2 text-xs font-semibold text-[#8f2448]">
        {isSaving ? "Saving cell..." : message}
      </div>
    </div>
  );
}
