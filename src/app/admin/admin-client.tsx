"use client";

import clsx from "clsx";
import { ArrowUpDown, Check, Copy, Download, Eye, GripVertical, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal, useFormStatus } from "react-dom";
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
import type { GuestWithRsvp, RsvpAttendeeDetails, RsvpAuditEvent } from "@/lib/db";
import { slugify } from "@/lib/slug";
import {
  addGuest,
  deleteGuest,
  editGuestCount,
  editGuestEmailAddress,
  editGuestName,
  editGuestNotes,
  editGuestPhoneNumber,
  editGuestSlug,
  loginAdmin,
  reorderGuestRows,
  setFuckYes,
  setInviteSent,
  type AdminActionState,
} from "./actions";

const initialState: AdminActionState = {
  ok: false,
  message: "",
};

export type AdminSortKey = "default" | "name" | "max" | "invite" | "rsvp" | "attending";
export type AdminSortDirection = "asc" | "desc";

type EditableColumnKey = "name" | "slug" | "notes" | "phoneNumber" | "emailAddress" | "guestCount";

const INVITATION_BASE_URL = "https://sexiwedding.com";

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

const BASE_COLUMN_WIDTHS = {
  rowNumber: 38,
  name: 174,
  slug: 160,
  notes: 170,
  phoneNumber: 142,
  emailAddress: 180,
  guestCount: 54,
  inviteSent: 97,
  rsvpStatus: 112,
  attendingCount: 61,
  attendeeDetails: 240,
  actions: 100,
  fuckYes: 82,
};

const BASE_GRID_WIDTH = Object.values(BASE_COLUMN_WIDTHS).reduce((total, width) => total + width, 0);

function getExpandedColumnWidths(gridWidth: number) {
  const extraWidth = Math.max(0, Math.floor(gridWidth) - BASE_GRID_WIDTH);
  const nameExtra = Math.floor(extraWidth * 0.4);
  const slugExtra = Math.floor(extraWidth * 0.15);
  const notesExtra = Math.floor(extraWidth * 0.15);
  const contactExtra = Math.floor(extraWidth * 0.1);
  const attendeeDetailsExtra = extraWidth - nameExtra - slugExtra - notesExtra - contactExtra;

  return {
    ...BASE_COLUMN_WIDTHS,
    name: BASE_COLUMN_WIDTHS.name + nameExtra,
    slug: BASE_COLUMN_WIDTHS.slug + slugExtra,
    notes: BASE_COLUMN_WIDTHS.notes + notesExtra,
    emailAddress: BASE_COLUMN_WIDTHS.emailAddress + contactExtra,
    attendeeDetails: BASE_COLUMN_WIDTHS.attendeeDetails + attendeeDetailsExtra,
  };
}

function slugDraftValue(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-");
}

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
    return "border-[#047857] bg-[#d1fae5] text-[#065f46]";
  }
  if (status === "no") {
    return "border-[#dc2626] bg-[#fee2e2] text-[#991b1b]";
  }
  if (status === "deciding") {
    return "border-[#d97706] bg-[#fef3c7] text-[#92400e]";
  }
  return "border-[#64748b] bg-[#e2e8f0] text-[#334155]";
}

function csvCell(value: boolean | number | string | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function mealLabel(mealType: RsvpAttendeeDetails["mealType"]) {
  if (mealType === "beef") {
    return "Beef";
  }
  if (mealType === "fish") {
    return "Fish";
  }
  if (mealType === "vegetarian") {
    return "Vegetarian";
  }
  return "";
}

function attendeeNameSummary(attendees: RsvpAttendeeDetails[]) {
  return attendees.map((attendee) => attendee.fullName).filter(Boolean).join("; ");
}

function attendeeMealSummary(attendees: RsvpAttendeeDetails[]) {
  return attendees
    .map((attendee, index) => {
      const meal = mealLabel(attendee.mealType);
      return meal ? `${attendee.fullName || `Guest ${index + 1}`}: ${meal}` : "";
    })
    .filter(Boolean)
    .join("; ");
}

function attendeeDietarySummary(attendees: RsvpAttendeeDetails[]) {
  return attendees
    .map((attendee, index) => {
      const notes = attendee.dietaryNotes.trim();
      return notes ? `${attendee.fullName || `Guest ${index + 1}`}: ${notes}` : "";
    })
    .filter(Boolean)
    .join("; ");
}

function attendeeDetailsSummary(attendees: RsvpAttendeeDetails[]) {
  return attendees
    .map((attendee, index) => {
      const name = attendee.fullName || `Guest ${index + 1}`;
      const meal = mealLabel(attendee.mealType);
      const notes = attendee.dietaryNotes.trim();
      const details = [meal, notes].filter(Boolean).join(", ");

      return details ? `${name} (${details})` : name;
    })
    .filter(Boolean)
    .join("; ");
}

function makeAdminCsv(guests: GuestWithRsvp[], auditEvents: RsvpAuditEvent[]) {
  const headers = [
    "record_type",
    "guest_id",
    "guest_name",
    "guest_slug",
    "invitation_url",
    "notes",
    "phone_number",
    "email_address",
    "max_guests",
    "invite_sent",
    "fuck_yes",
    "sort_order",
    "current_rsvp_status",
    "current_attending_count",
    "current_place_cards",
    "current_meal_choices",
    "current_dietary_notes",
    "guest_created_at",
    "guest_updated_at",
    "audit_event_id",
    "audit_event_type",
    "audit_guest_name_previous",
    "audit_guest_name_current",
    "audit_rsvp_status",
    "audit_attending_count",
    "audit_place_cards",
    "audit_meal_choices",
    "audit_dietary_notes",
    "audit_created_at",
  ];

  const guestRows = guests.map((guest) => [
    "guest",
    guest.id,
    guest.name,
    guest.slug,
    `${INVITATION_BASE_URL}/${guest.slug}`,
    guest.notes,
    guest.phoneNumber,
    guest.emailAddress,
    guest.guestCount,
    guest.inviteSent,
    guest.fuckYes,
    guest.sortOrder,
    guest.rsvpStatus,
    guest.attendingCount,
    attendeeNameSummary(guest.attendeeDetails),
    attendeeMealSummary(guest.attendeeDetails),
    attendeeDietarySummary(guest.attendeeDetails),
    guest.createdAt,
    guest.updatedAt,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  const auditRows = auditEvents.map((event) => [
    "rsvp_audit",
    event.guestId,
    event.guestName,
    event.guestSlug,
    `${INVITATION_BASE_URL}/${event.guestSlug}`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    event.id,
    event.eventType,
    event.guestNamePrevious,
    event.guestNameCurrent,
    event.status,
    event.attendingCount,
    attendeeNameSummary(event.attendeeDetails),
    attendeeMealSummary(event.attendeeDetails),
    attendeeDietarySummary(event.attendeeDetails),
    event.createdAt,
  ]);

  return [headers, ...guestRows, ...auditRows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

export function AdminCsvExportButton({
  auditEvents,
  guests,
}: {
  auditEvents: RsvpAuditEvent[];
  guests: GuestWithRsvp[];
}) {
  const [exportStatus, setExportStatus] = useState<"idle" | "exported">("idle");

  useEffect(() => {
    if (exportStatus === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => setExportStatus("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [exportStatus]);

  function exportCsv() {
    const csv = makeAdminCsv(guests, auditEvents);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `sexi-wedding-admin-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setExportStatus("exported");
  }

  return (
    <button
      type="button"
      onClick={exportCsv}
      aria-label={exportStatus === "exported" ? "CSV exported" : "Export all admin data as CSV"}
      title={exportStatus === "exported" ? "CSV exported" : "Export all admin data as CSV"}
      className="inline-flex min-h-8 items-center justify-center gap-1.5 border border-[#7a1239] bg-[#fff8fb] px-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#7a1239] transition hover:border-[#be185d] hover:bg-[#ffe0ec]"
    >
      {exportStatus === "exported" ? (
        <Check aria-hidden="true" className="size-3.5 stroke-[3]" />
      ) : (
        <Download aria-hidden="true" className="size-3.5" />
      )}
      <span aria-live="polite">{exportStatus === "exported" ? "Exported" : "Export CSV"}</span>
    </button>
  );
}

export function LocalAuditTimestamp({ value }: { value: string }) {
  const [formattedTimestamp, setFormattedTimestamp] = useState("");
  const date = new Date(value);
  const dateTime = Number.isNaN(date.getTime()) ? value : date.toISOString();

  useEffect(() => {
    setFormattedTimestamp(new Intl.DateTimeFormat(navigator.language || "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(new Date(value)));
  }, [value]);

  return (
    <time dateTime={dateTime} suppressHydrationWarning>
      {formattedTimestamp || "Loading..."}
    </time>
  );
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
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(name));
    }
  }, [name, slugTouched]);

  const canAddGuest = Boolean(name.trim() && slug);

  return (
    <div className="border-b border-[#df7fa3] bg-[#fff1f7]">
      {/* On phones the add-guest form is collapsed behind this toggle so it does
          not eat vertical space until an admin is actually adding someone. On
          md+ the toggle is hidden and the form is always shown. */}
      <button
        type="button"
        onClick={() => setIsFormOpen((open) => !open)}
        aria-expanded={isFormOpen}
        aria-controls="add-guest-fields"
        className={clsx(
          "flex w-full items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#7a1239] transition hover:bg-[#ffe0ec] md:hidden",
          isFormOpen && "border-b border-[#efb5c9]",
        )}
      >
        {isFormOpen ? (
          <>
            <X aria-hidden="true" className="size-3.5" />
            Close add guest
          </>
        ) : (
          <>
            <Plus aria-hidden="true" className="size-3.5" />
            Add a guest
          </>
        )}
      </button>
      <form
        id="add-guest-fields"
        action={formAction}
        className={clsx(isFormOpen ? "block" : "hidden", "md:block")}
      >
      <div className="grid grid-cols-1 border-b border-[#efb5c9] md:grid-cols-[minmax(12rem,1fr)_minmax(12rem,0.95fr)_5.5rem_minmax(12rem,0.85fr)_minmax(14rem,1fr)_minmax(16rem,1fr)_minmax(12rem,0.85fr)_7rem]">
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
              setSlug(slugDraftValue(event.target.value));
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
          Phone
          <input
            name="phoneNumber"
            type="text"
            className="min-h-9 border border-[#df7fa3] bg-[#fff8fb] px-2 text-base font-normal normal-case tracking-normal text-[#4a1027] outline-none transition placeholder:text-[#4a1027]/35 focus:border-[#be185d] focus:ring-1 focus:ring-[#be185d]/30 md:min-h-7 md:text-sm"
          />
        </label>
        <label className="grid gap-1 border-b border-[#efb5c9] px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#8f2448] md:border-r md:border-b-0">
          Email
          <input
            name="emailAddress"
            type="email"
            className="min-h-9 border border-[#df7fa3] bg-[#fff8fb] px-2 text-base font-normal normal-case tracking-normal text-[#4a1027] outline-none transition placeholder:text-[#4a1027]/35 focus:border-[#be185d] focus:ring-1 focus:ring-[#be185d]/30 md:min-h-7 md:text-sm"
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
    </div>
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
  const [mounted, setMounted] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction] = useActionState(deleteGuest, initialState);

  useEffect(() => {
    setMounted(true);
  }, []);

  function closeDialog() {
    setOpen(false);
    setConfirmation("");
  }

  const dialog =
    open && mounted
      ? createPortal(
          <div
            data-admin-delete-modal="true"
            className="fixed inset-0 z-[100] grid place-items-center bg-[#4a1027]/35 px-4"
          >
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
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${guestName}`}
        title="Delete"
        className="grid size-7 place-items-center border border-[#e7a1ba] bg-[#fff1f7] text-[#be123c] transition hover:border-[#be123c] hover:bg-[#ffe0ec]"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </button>

      {dialog}
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

export function FuckYesToggle({
  guestId,
  fuckYes,
}: {
  guestId: number;
  fuckYes: boolean;
}) {
  const [checked, setChecked] = useState(fuckYes);
  const [message, setMessage] = useState("");
  const [isSaving, startTransition] = useTransition();

  useEffect(() => {
    setChecked(fuckYes);
  }, [fuckYes]);

  function toggle() {
    const nextChecked = !checked;
    setChecked(nextChecked);
    setMessage("Saving...");

    startTransition(() => {
      void setFuckYes(initialState, makeFormData({
        guestId,
        fuckYes: nextChecked,
      })).then((result) => {
        setMessage(result.message);

        if (!result.ok) {
          setChecked(checked);
        }
      }).catch(() => {
        setChecked(checked);
        setMessage("Fuck yes mode could not be saved.");
      });
    });
  }

  return (
    <div className="flex items-center justify-center">
      <button
        type="button"
        disabled={isSaving}
        onClick={toggle}
        aria-label={checked ? "Turn off fuck yes options" : "Turn on fuck yes options"}
        title={message || (checked ? "Fuck yes options on" : "Fuck yes options off")}
        className={clsx(
          "grid size-6 place-items-center border transition disabled:cursor-wait disabled:opacity-65",
          checked
            ? "border-[#be185d] bg-[#f9a8d4] text-[#7a1239] hover:bg-[#f472b6]"
            : "border-[#df7fa3] bg-white text-transparent hover:border-[#be185d] hover:bg-[#fff1f7]",
        )}
      >
        <Check aria-hidden="true" className="size-3.5 stroke-[3]" />
      </button>
    </div>
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
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    if (key === "emailAddress" && inputRef.current && !inputRef.current.reportValidity()) {
      return;
    }

    const nextValue = key === "slug" ? slugify(value) : value;
    onRowChange({ ...row, [key]: nextValue }, true);
  }

  return (
    <input
      ref={inputRef}
      autoFocus
      type={key === "emailAddress" ? "email" : "text"}
      value={value}
      onBlur={commit}
      onChange={(event) => setValue(key === "slug" ? slugDraftValue(event.target.value) : event.target.value)}
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
      className="h-full w-full border-0 bg-white px-2 text-base text-[#4a1027] outline-none"
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
      className="h-full w-full border-0 bg-white px-2 text-left font-mono text-base tabular-nums text-[#4a1027] outline-none"
    />
  );
}

function SlugCell({ row }: RenderCellProps<GuestWithRsvp>) {
  return (
    <span
      title={row.inviteSent ? "URL locked after invite sent" : undefined}
      className={clsx("font-mono text-[#be185d]", row.inviteSent && "text-[#8f5070]")}
    >
      /{row.slug}
    </span>
  );
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
  return attendeeDetailsSummary(row.attendeeDetails);
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.inset = "-9999px auto auto -9999px";
  document.body.append(textArea);
  textArea.select();
  document.execCommand("copy");
  textArea.remove();
}

function CopyInvitationLinkButton({ slug }: { slug: string }) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const invitationUrl = `${INVITATION_BASE_URL}/${slug}`;

  useEffect(() => {
    if (copyStatus === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => setCopyStatus("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  return (
    <button
      type="button"
      aria-label={copyStatus === "copied" ? "Copied invitation link" : "Copy invitation link"}
      title={copyStatus === "failed" ? "Copy failed" : copyStatus === "copied" ? "Copied" : "Copy link"}
      onClick={() => {
        void copyText(invitationUrl)
          .then(() => setCopyStatus("copied"))
          .catch(() => setCopyStatus("failed"));
      }}
      className={clsx(
        "admin-copy-button grid size-7 place-items-center border bg-white font-semibold transition hover:border-[#be185d] hover:bg-[#fff1f7]",
        copyStatus === "copied"
          ? "admin-copy-button-copied border-[#047857] text-[#047857]"
          : copyStatus === "failed"
            ? "admin-copy-button-failed border-[#dc2626] text-[#dc2626]"
            : "border-[#d65b8a] text-[#8f2448]",
      )}
    >
      {copyStatus === "copied" ? (
        <Check aria-hidden="true" className="size-4 stroke-[3]" />
      ) : (
        <Copy aria-hidden="true" className="size-3.5" />
      )}
      <span className="sr-only" aria-live="polite">
        {copyStatus === "copied" ? "Copied invitation link" : copyStatus === "failed" ? "Copy failed" : ""}
      </span>
    </button>
  );
}

function ActionsCell({ row }: RenderCellProps<GuestWithRsvp>) {
  return (
    <div className="flex items-center gap-1.5">
      <CopyInvitationLinkButton slug={row.slug} />
      <Link
        href={`/${row.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`View invitation for ${row.name}`}
        title="View invitation"
        className="grid size-7 place-items-center border border-[#d65b8a] bg-[#fff1f7] font-semibold text-[#8f2448] transition hover:border-[#be185d] hover:bg-[#ffe0ec]"
      >
        <Eye aria-hidden="true" className="size-4" />
      </Link>
      <DeleteGuestButton guestId={row.id} guestName={row.name} />
    </div>
  );
}

function InviteCell({ row }: RenderCellProps<GuestWithRsvp>) {
  return <InviteSentToggle guestId={row.id} inviteSent={row.inviteSent} />;
}

function FuckYesCell({ row }: RenderCellProps<GuestWithRsvp>) {
  return <FuckYesToggle guestId={row.id} fuckYes={row.fuckYes} />;
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
    if (previousRow.inviteSent) {
      return { ok: false, message: "URL cannot be changed after invite sent is checked." };
    }

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

  if (columnKey === "phoneNumber") {
    return editGuestPhoneNumber(initialState, makeFormData({
      guestId: previousRow.id,
      phoneNumber: nextRow.phoneNumber,
    }));
  }

  if (columnKey === "emailAddress") {
    return editGuestEmailAddress(initialState, makeFormData({
      guestId: previousRow.id,
      emailAddress: nextRow.emailAddress,
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
  const spreadsheetShellRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(guests);
  const [draggedGuestId, setDraggedGuestId] = useState<number | null>(null);
  const [gridWidth, setGridWidth] = useState(BASE_GRID_WIDTH);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [isSaving, startTransition] = useTransition();

  useEffect(() => {
    setRows(guests);
  }, [guests]);

  useEffect(() => {
    const spreadsheetShell = spreadsheetShellRef.current;

    if (!spreadsheetShell) {
      return;
    }

    function updateGridWidth() {
      setGridWidth(Math.max(BASE_GRID_WIDTH, Math.floor(spreadsheetShell?.clientWidth ?? BASE_GRID_WIDTH)));
    }

    updateGridWidth();

    const resizeObserver = new ResizeObserver(updateGridWidth);
    resizeObserver.observe(spreadsheetShell);

    return () => resizeObserver.disconnect();
  }, []);

  const queryTokens = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? normalized.split(/\s+/) : [];
  }, [query]);
  const isSearching = queryTokens.length > 0;

  const visibleRows = useMemo(() => {
    if (queryTokens.length === 0) {
      return rows;
    }

    return rows.filter((row) => {
      // Match every token somewhere in the guest name or any RSVP place-card name,
      // so "Sean" and "Lexi" both find the "Sean and Lexi" invitation.
      const haystack = [row.name, ...row.attendeeDetails.map((attendee) => attendee.fullName)]
        .join(" ")
        .toLowerCase();

      return queryTokens.every((token) => haystack.includes(token));
    });
  }, [queryTokens, rows]);

  // Drag-to-reorder saves the full ordered id list, so only allow it when the
  // complete, unfiltered list is shown.
  const canReorder = isDefaultSort && !isSearching;

  const sortColumns = useMemo<SortColumn[]>(() => {
    if (activeSortKey === "default") {
      return [];
    }

    return [{
      columnKey: SORT_KEY_TO_COLUMN_KEY[activeSortKey],
      direction: activeDirection === "asc" ? "ASC" : "DESC",
    }];
  }, [activeDirection, activeSortKey]);

  const handleRowDrop = useCallback((targetGuestId: number, sourceGuestId: number | null) => {
    if (!canReorder || isSaving || sourceGuestId === null || sourceGuestId === targetGuestId) {
      return;
    }

    const fromIndex = rows.findIndex((guest) => guest.id === sourceGuestId);
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
  }, [canReorder, isSaving, rows]);

  const handleDefaultSort = useCallback(() => {
    if (!isDefaultSort) {
      window.location.href = "/admin";
    }
  }, [isDefaultSort]);

  const columnWidths = useMemo(() => getExpandedColumnWidths(gridWidth), [gridWidth]);

  const columns = useMemo<Column<GuestWithRsvp>[]>(() => [
    {
      key: "rowNumber",
      name: "",
      width: columnWidths.rowNumber,
      minWidth: 34,
      resizable: true,
      frozen: true,
      renderHeaderCell() {
        return (
          <button
            type="button"
            aria-label="Show default guest order"
            title="Default order"
            disabled={isDefaultSort}
            onClick={handleDefaultSort}
            className="admin-row-order-header-button"
          >
            <ArrowUpDown aria-hidden="true" className="size-3.5" />
          </button>
        );
      },
      renderCell({ row, rowIdx }) {
        return (
          <div
            className="flex h-full items-center justify-center"
            onDragOver={(event) => {
              if (canReorder && draggedGuestId !== null) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              const sourceGuestId = Number(event.dataTransfer.getData("text/plain"));
              handleRowDrop(row.id, Number.isInteger(sourceGuestId) ? sourceGuestId : draggedGuestId);
              setDraggedGuestId(null);
            }}
          >
            {canReorder ? (
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
              <span className="font-mono text-[0.85rem] tabular-nums text-[#8f5070]">{rowIdx + 1}</span>
            )}
          </div>
        );
      },
    },
    {
      key: "name",
      name: "Name",
      width: columnWidths.name,
      minWidth: 132,
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
      width: columnWidths.slug,
      minWidth: 126,
      resizable: true,
      editable: (row) => !row.inviteSent,
      cellClass: (row) => row.inviteSent ? "admin-cell-locked" : undefined,
      renderEditCell: SpreadsheetTextEditor,
      renderCell: SlugCell,
    },
    {
      key: "notes",
      name: "Notes",
      width: columnWidths.notes,
      minWidth: 120,
      resizable: true,
      editable: true,
      renderEditCell: SpreadsheetTextEditor,
    },
    {
      key: "phoneNumber",
      name: "Phone",
      width: columnWidths.phoneNumber,
      minWidth: 112,
      resizable: true,
      editable: true,
      renderEditCell: SpreadsheetTextEditor,
    },
    {
      key: "emailAddress",
      name: "Email",
      width: columnWidths.emailAddress,
      minWidth: 140,
      resizable: true,
      editable: true,
      renderEditCell: SpreadsheetTextEditor,
    },
    {
      key: "guestCount",
      name: "Max",
      width: columnWidths.guestCount,
      minWidth: 48,
      sortable: true,
      resizable: true,
      editable: true,
      renderEditCell: SpreadsheetNumberEditor,
      renderCell({ row }) {
        return <span className="admin-number-cell">{row.guestCount}</span>;
      },
    },
    {
      key: "inviteSent",
      name: "Invite sent",
      width: columnWidths.inviteSent,
      minWidth: 72,
      sortable: true,
      resizable: true,
      renderCell: InviteCell,
    },
    {
      key: "rsvpStatus",
      name: "RSVP",
      width: columnWidths.rsvpStatus,
      minWidth: 96,
      sortable: true,
      resizable: true,
      renderCell: RsvpCell,
    },
    {
      key: "attendingCount",
      name: "Count",
      width: columnWidths.attendingCount,
      minWidth: 52,
      sortable: true,
      resizable: true,
      renderCell({ row }) {
        return row.attendingCount === null ? "" : <span className="admin-number-cell">{row.attendingCount}</span>;
      },
    },
    {
      key: "attendeeDetails",
      name: "Place cards / meals",
      width: columnWidths.attendeeDetails,
      minWidth: 140,
      resizable: true,
      renderCell: PlaceCardsCell,
    },
    {
      key: "actions",
      name: "Actions",
      width: columnWidths.actions,
      minWidth: 94,
      resizable: true,
      renderCell: ActionsCell,
    },
    {
      key: "fuckYes",
      name: "Fuck yes",
      width: columnWidths.fuckYes,
      minWidth: 74,
      resizable: true,
      renderCell: FuckYesCell,
    },
  ], [canReorder, columnWidths, draggedGuestId, handleDefaultSort, handleRowDrop, isDefaultSort, isSaving]);

  function handleRowsChange(
    nextVisibleRows: GuestWithRsvp[],
    { indexes, column }: RowsChangeData<GuestWithRsvp>,
  ) {
    const previousRows = rows;
    const previousVisibleRows = visibleRows;

    // The grid edits the filtered view, so merge changes back into the full row
    // list by id rather than replacing it wholesale.
    const editedById = new Map<number, GuestWithRsvp>();
    for (const rowIndex of indexes) {
      const nextRow = nextVisibleRows[rowIndex];
      if (nextRow) {
        editedById.set(nextRow.id, nextRow);
      }
    }
    setRows(previousRows.map((row) => editedById.get(row.id) ?? row));

    startTransition(() => {
      void Promise.all(
        indexes.map(async (rowIndex) => {
          const previousRow = previousVisibleRows[rowIndex];
          const nextRow = nextVisibleRows[rowIndex];

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
    const editable = typeof args.column.editable === "function"
      ? args.column.editable(args.row)
      : Boolean(args.column.editable);

    if (editable) {
      args.selectCell(true);
      event.preventGridDefault();
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-2 border-b border-[#df7fa3] bg-[#f4bfd2] px-3 py-2 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-[#a33a62]"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search guests by name"
            placeholder="Search by name (Sean, Lexi, place-card name…)"
            className="min-h-8 w-full border border-[#df7fa3] bg-[#fff8fb] pl-8 pr-3 text-sm font-normal normal-case tracking-normal text-[#4a1027] outline-none transition placeholder:text-[#4a1027]/40 focus:border-[#be185d] focus:ring-1 focus:ring-[#be185d]/30"
          />
        </div>
        {isSearching ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-[#7a1239]">
            <span className="tabular-nums" role="status" aria-live="polite">
              {visibleRows.length} of {rows.length} shown
            </span>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="inline-flex min-h-7 items-center border border-[#df7fa3] bg-[#fff8fb] px-2 uppercase tracking-[0.08em] text-[#7a1239] transition hover:border-[#be185d] hover:bg-[#ffe0ec]"
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>
      <div ref={spreadsheetShellRef} className="admin-spreadsheet-shell">
        <DataGrid
          aria-label="Guest RSVP spreadsheet"
          className="rdg-light admin-spreadsheet"
          columns={columns}
          rows={visibleRows}
          rowKeyGetter={rowKeyGetter}
          onRowsChange={handleRowsChange}
          sortColumns={sortColumns}
          onSortColumnsChange={handleSortColumnsChange}
          onCellClick={handleCellClick}
          defaultColumnOptions={{ resizable: true }}
          rowHeight={50}
          headerRowHeight={42}
          enableVirtualization={false}
          renderers={{
            noRowsFallback: (
              <div className="grid h-full place-items-center px-3 py-8 text-sm text-[#8f5070]">
                {isSearching ? "No guests match your search." : "No guests have been added yet."}
              </div>
            ),
          }}
        />
        <div className="flex min-h-7 items-center border-t border-[#df7fa3] bg-[#fff1f7] px-2 text-xs font-semibold text-[#8f2448]">
          {isSaving ? "Saving cell..." : message}
        </div>
      </div>
    </div>
  );
}
