"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { ArrowUp, Check, GripVertical } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { GuestWithRsvp } from "@/lib/db";
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
import { slugify } from "@/lib/slug";

const initialState: AdminActionState = {
  ok: false,
  message: "",
};

type SortableAttributes = ReturnType<typeof useSortable>["attributes"];
type SortableListeners = ReturnType<typeof useSortable>["listeners"];
type SortableActivatorRef = ReturnType<typeof useSortable>["setActivatorNodeRef"];
export type AdminSortKey = "default" | "name" | "max" | "invite" | "rsvp" | "attending";
export type AdminSortDirection = "asc" | "desc";

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

function sortHref(sortKey: AdminSortKey, activeSortKey: AdminSortKey, activeDirection: AdminSortDirection) {
  if (sortKey === "default") {
    return "/admin";
  }

  const nextDirection = activeSortKey === sortKey && activeDirection === "asc" ? "desc" : "asc";
  return `/admin?sort=${sortKey}&dir=${nextDirection}`;
}

function SortArrowIcon({ direction }: { direction: AdminSortDirection }) {
  return (
    <ArrowUp
      aria-hidden="true"
      className={clsx("size-3 transition-transform", direction === "desc" && "rotate-180")}
      strokeWidth={3}
    />
  );
}

function SortHeader({
  label,
  sortKey,
  activeSortKey,
  activeDirection,
  className,
}: {
  label: string;
  sortKey: AdminSortKey;
  activeSortKey: AdminSortKey;
  activeDirection: AdminSortDirection;
  className?: string;
}) {
  const isActive = activeSortKey === sortKey;

  return (
    <Link
      href={sortHref(sortKey, activeSortKey, activeDirection)}
      className={clsx(
        "group inline-flex min-h-6 items-center gap-1.5 rounded-sm px-1.5 py-0.5 transition hover:bg-[#fff1f7] hover:text-[#8f2448]",
        className,
      )}
    >
      <span>{label}</span>
      <span
        className={clsx(
          "inline-grid size-5 place-items-center rounded-full border transition",
          isActive
            ? "border-[#be185d] bg-[#8f2448] text-[#fff8fb] shadow-[0_1px_4px_rgba(143,36,72,0.22)]"
            : "border-[#d65b8a]/45 bg-[#fff8fb]/60 text-[#8f5070] opacity-55 group-hover:opacity-100",
        )}
      >
        <SortArrowIcon direction={isActive ? activeDirection : "asc"} />
      </span>
    </Link>
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
            className="min-h-7 border border-[#df7fa3] bg-[#fff8fb] px-2 text-sm font-normal normal-case tracking-normal text-[#4a1027] outline-none transition placeholder:text-[#4a1027]/35 focus:border-[#be185d] focus:ring-1 focus:ring-[#be185d]/30"
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
            className="min-h-7 border border-[#df7fa3] bg-[#fff8fb] px-2 text-sm font-normal normal-case tracking-normal text-[#4a1027] outline-none transition placeholder:text-[#4a1027]/35 focus:border-[#be185d] focus:ring-1 focus:ring-[#be185d]/30"
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
            className="min-h-7 border border-[#df7fa3] bg-[#fff8fb] px-2 text-sm font-normal normal-case tracking-normal text-[#4a1027] outline-none transition focus:border-[#be185d] focus:ring-1 focus:ring-[#be185d]/30"
          />
        </label>
        <label className="grid gap-1 border-b border-[#efb5c9] px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[#8f2448] md:border-r md:border-b-0">
          Notes
          <input
            name="notes"
            className="min-h-7 border border-[#df7fa3] bg-[#fff8fb] px-2 text-sm font-normal normal-case tracking-normal text-[#4a1027] outline-none transition placeholder:text-[#4a1027]/35 focus:border-[#be185d] focus:ring-1 focus:ring-[#be185d]/30"
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
        className="min-h-6 border border-[#e7a1ba] bg-[#fff1f7] px-2 font-semibold text-[#be123c] transition hover:border-[#be123c] hover:bg-[#ffe0ec]"
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
                Delete <span className="font-semibold text-[#7f1d1d]">{guestName}</span> and any RSVP/place-card rows for this guest.
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
  const [checked, setChecked] = useState(inviteSent);

  useEffect(() => {
    setChecked(inviteSent);
  }, [inviteSent]);

  return (
    <form action={formAction} className="flex items-center justify-center">
      <input type="hidden" name="guestId" value={guestId} />
      <input type="hidden" name="inviteSent" value={checked ? "false" : "true"} />
      <InviteSentSubmitButton checked={checked} message={state.message} />
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
        "grid size-5 place-items-center border transition disabled:cursor-wait disabled:opacity-65",
        checked
          ? "border-[#d65b8a] bg-[#ffe0ec] text-[#7a1239] hover:bg-[#ffd4e5]"
          : "border-[#df7fa3] bg-white text-transparent hover:border-[#be185d] hover:bg-[#fff1f7]",
      )}
    >
      <Check aria-hidden="true" className="size-3.5 stroke-[3]" />
    </button>
  );
}

function SaveNameButton({ disabled, label = "Save" }: { disabled: boolean; label?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      aria-label={label}
      disabled={disabled || pending}
      className="min-h-7 border border-[#d65b8a] bg-[#fff1f7] px-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#8f2448] transition hover:border-[#be185d] hover:bg-[#ffe0ec] disabled:cursor-not-allowed disabled:border-[#efb5c9] disabled:bg-[#fff8fb] disabled:text-[#b8899b]"
    >
      {pending ? "Saving" : "Save"}
    </button>
  );
}

export function GuestNameEditor({
  guestId,
  slug,
  name,
}: {
  guestId: number;
  slug: string;
  name: string;
}) {
  const [state, formAction] = useActionState(editGuestName, initialState);
  const [value, setValue] = useState(name);

  useEffect(() => {
    setValue(name);
  }, [name]);

  const trimmedValue = value.trim();
  const hasChanged = trimmedValue !== name;

  return (
    <form action={formAction} className="grid min-w-0 grid-cols-[minmax(12rem,1fr)_auto] items-center gap-1.5">
      <input type="hidden" name="guestId" value={guestId} />
      <input type="hidden" name="slug" value={slug} />
      <input
        name="name"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label={`Guest name for ${name}`}
        className="min-h-7 min-w-0 border border-transparent bg-transparent px-1 text-xs font-semibold text-[#4a1027] outline-none transition hover:border-[#efb5c9] hover:bg-white focus:border-[#be185d] focus:bg-white focus:ring-1 focus:ring-[#be185d]/25"
      />
      <SaveNameButton disabled={!hasChanged || !trimmedValue} label={`Save name for ${name}`} />
      {state.message ? (
        <p
          className={`col-span-2 text-[0.68rem] font-semibold ${state.ok ? "text-[#8f2448]" : "text-[#be123c]"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function GuestNotesEditor({
  guestId,
  name,
  notes,
}: {
  guestId: number;
  name: string;
  notes: string;
}) {
  const [state, formAction] = useActionState(editGuestNotes, initialState);
  const [value, setValue] = useState(notes);

  useEffect(() => {
    setValue(notes);
  }, [notes]);

  const trimmedValue = value.trim();
  const hasChanged = trimmedValue !== notes;

  return (
    <form action={formAction} className="grid min-w-0 grid-cols-[minmax(12rem,1fr)_auto] items-center gap-1.5">
      <input type="hidden" name="guestId" value={guestId} />
      <input
        name="notes"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label={`Admin notes for ${name}`}
        className="min-h-7 min-w-0 border border-transparent bg-transparent px-1 text-xs text-[#4a1027] outline-none transition hover:border-[#efb5c9] hover:bg-white focus:border-[#be185d] focus:bg-white focus:ring-1 focus:ring-[#be185d]/25"
      />
      <SaveNameButton disabled={!hasChanged} label={`Save notes for ${name}`} />
      {state.message ? (
        <p
          className={`col-span-2 text-[0.68rem] font-semibold ${state.ok ? "text-[#8f2448]" : "text-[#be123c]"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function GuestCountEditor({
  guestId,
  slug,
  name,
  guestCount,
}: {
  guestId: number;
  slug: string;
  name: string;
  guestCount: number;
}) {
  const [state, formAction] = useActionState(editGuestCount, initialState);
  const [value, setValue] = useState(String(guestCount));

  useEffect(() => {
    setValue(String(guestCount));
  }, [guestCount]);

  const numericValue = Number(value);
  const hasChanged = numericValue !== guestCount;
  const isValid = Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 10;

  return (
    <form action={formAction} className="grid min-w-0 grid-cols-[3rem_auto] items-center justify-end gap-1">
      <input type="hidden" name="guestId" value={guestId} />
      <input type="hidden" name="slug" value={slug} />
      <input
        name="guestCount"
        type="number"
        min="1"
        max="10"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label={`Max guests for ${name}`}
        className="min-h-7 min-w-0 border border-transparent bg-transparent px-1 text-right font-mono text-xs tabular-nums text-[#4a1027] outline-none transition hover:border-[#efb5c9] hover:bg-white focus:border-[#be185d] focus:bg-white focus:ring-1 focus:ring-[#be185d]/25"
      />
      <SaveNameButton
        disabled={!hasChanged || !isValid}
        label={`Save max guests for ${name}`}
      />
      {state.message ? (
        <p
          className={`col-span-2 text-right text-[0.68rem] font-semibold ${state.ok ? "text-[#8f2448]" : "text-[#be123c]"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function GuestSlugEditor({
  guestId,
  slug,
}: {
  guestId: number;
  slug: string;
}) {
  const [state, formAction] = useActionState(editGuestSlug, initialState);
  const [value, setValue] = useState(slug);

  useEffect(() => {
    setValue(slug);
  }, [slug]);

  const hasChanged = value !== slug;

  return (
    <form action={formAction} className="grid min-w-0 grid-cols-[auto_minmax(9rem,1fr)_auto] items-center gap-1">
      <input type="hidden" name="guestId" value={guestId} />
      <input type="hidden" name="oldSlug" value={slug} />
      <span className="font-mono text-[0.7rem] text-[#be185d]">/</span>
      <input
        name="slug"
        value={value}
        onChange={(event) => setValue(slugify(event.target.value))}
        aria-label={`URL slug for ${slug}`}
        className="min-h-7 min-w-0 border border-transparent bg-transparent px-1 font-mono text-[0.7rem] text-[#be185d] outline-none transition hover:border-[#efb5c9] hover:bg-white focus:border-[#be185d] focus:bg-white focus:ring-1 focus:ring-[#be185d]/25"
      />
      <SaveNameButton disabled={!hasChanged || !value} label={`Save URL slug for ${slug}`} />
      {state.message ? (
        <p
          className={`col-span-3 text-[0.68rem] font-semibold ${state.ok ? "text-[#8f2448]" : "text-[#be123c]"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function RowOrderHandle({
  rowNumber,
  enabled,
  isSaving,
  attributes,
  listeners,
  setActivatorNodeRef,
}: {
  rowNumber: number;
  enabled: boolean;
  isSaving: boolean;
  attributes?: SortableAttributes;
  listeners?: SortableListeners;
  setActivatorNodeRef?: SortableActivatorRef;
}) {
  if (!enabled) {
    return (
      <span className="font-mono text-[0.7rem] tabular-nums text-[#8f5070]">
        {rowNumber}
      </span>
    );
  }

  return (
    <div className="grid grid-cols-[1.4rem_1.75rem] items-center gap-1">
      <span className="font-mono text-[0.7rem] tabular-nums text-[#8f5070]">{rowNumber}</span>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        data-rsvp-drag-handle="true"
        disabled={isSaving}
        aria-label="Drag to reorder row"
        title="Drag to reorder"
        className="grid size-7 cursor-grab place-items-center border border-[#be185d] bg-[#ffe0ec] text-[#7a1239] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)] transition hover:bg-[#ffd4e5] active:cursor-grabbing disabled:cursor-wait disabled:border-[#efb5c9] disabled:bg-[#ffeaf2] disabled:text-[#b8899b]"
      >
        <GripVertical aria-hidden="true" className="size-4 stroke-[2.5]" />
      </button>
    </div>
  );
}

function GuestRowCells({
  attributes,
  guest,
  isSaving,
  listeners,
  rowNumber,
  setActivatorNodeRef,
  sortable,
}: {
  attributes?: SortableAttributes;
  guest: GuestWithRsvp;
  isSaving: boolean;
  listeners?: SortableListeners;
  rowNumber: number;
  setActivatorNodeRef?: SortableActivatorRef;
  sortable: boolean;
}) {
  return (
    <>
      <td className="border-r border-b border-[#efb5c9] px-2 py-1">
        <RowOrderHandle
          rowNumber={rowNumber}
          enabled={sortable}
          isSaving={isSaving}
          attributes={attributes}
          listeners={listeners}
          setActivatorNodeRef={setActivatorNodeRef}
        />
      </td>
      <td className="border-r border-b border-[#efb5c9] px-1 py-1">
        <GuestNameEditor guestId={guest.id} slug={guest.slug} name={guest.name} />
      </td>
      <td className="border-r border-b border-[#efb5c9] px-1 py-1">
        <GuestSlugEditor guestId={guest.id} slug={guest.slug} />
      </td>
      <td className="border-r border-b border-[#efb5c9] px-1 py-1">
        <GuestNotesEditor guestId={guest.id} name={guest.name} notes={guest.notes} />
      </td>
      <td className="border-r border-b border-[#efb5c9] px-1 py-1">
        <GuestCountEditor
          guestId={guest.id}
          slug={guest.slug}
          name={guest.name}
          guestCount={guest.guestCount}
        />
      </td>
      <td className="border-r border-b border-[#efb5c9] px-2 py-1 text-center">
        <InviteSentToggle guestId={guest.id} inviteSent={guest.inviteSent} />
      </td>
      <td className="border-r border-b border-[#efb5c9] px-2 py-1">
        <span className={`inline-flex min-w-24 justify-center border px-1.5 py-0.5 font-semibold ${rsvpClassName(guest.rsvpStatus)}`}>
          {rsvpLabel(guest.rsvpStatus)}
        </span>
      </td>
      <td className="border-r border-b border-[#efb5c9] px-2 py-1 text-right font-mono tabular-nums">
        {guest.attendingCount ?? ""}
      </td>
      <td className="border-r border-b border-[#efb5c9] px-2 py-1 text-[#4a1027]">
        {guest.attendeeNames.length > 0 ? guest.attendeeNames.join("; ") : ""}
      </td>
      <td className="border-b border-[#efb5c9] px-2 py-1">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/${guest.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-6 border border-[#d65b8a] bg-[#fff1f7] px-2 py-0.5 font-semibold text-[#8f2448] transition hover:border-[#be185d] hover:bg-[#ffe0ec]"
          >
            View invitation
          </Link>
          <DeleteGuestButton guestId={guest.id} guestName={guest.name} />
        </div>
      </td>
    </>
  );
}

function GuestRow({
  guest,
  rowNumber,
}: {
  guest: GuestWithRsvp;
  rowNumber: number;
}) {
  return (
    <tr
      data-guest-id={guest.id}
      className={clsx(
        "hover:bg-[#ffd8e8]",
        rowNumber % 2 === 1 ? "bg-[#fff8fb]" : "bg-[#ffeaf2]",
      )}
    >
      <GuestRowCells
        guest={guest}
        rowNumber={rowNumber}
        isSaving={false}
        sortable={false}
      />
    </tr>
  );
}

function SortableGuestRow({
  guest,
  rowNumber,
  isSaving,
}: {
  guest: GuestWithRsvp;
  rowNumber: number;
  isSaving: boolean;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: guest.id, disabled: isSaving });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      data-guest-id={guest.id}
      className={clsx(
        "hover:bg-[#ffd8e8]",
        rowNumber % 2 === 1 ? "bg-[#fff8fb]" : "bg-[#ffeaf2]",
        isDragging && "relative z-20 opacity-75 shadow-[0_10px_28px_-18px_rgba(143,36,72,0.9)]",
      )}
    >
      <GuestRowCells
        attributes={attributes}
        guest={guest}
        isSaving={isSaving}
        listeners={listeners}
        rowNumber={rowNumber}
        setActivatorNodeRef={setActivatorNodeRef}
        sortable
      />
    </tr>
  );
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
  const [orderedGuests, setOrderedGuests] = useState(guests);
  const [message, setMessage] = useState("");
  const [isSaving, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setOrderedGuests(guests);
  }, [guests]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!isDefaultSort || isSaving || !over || active.id === over.id) {
      return;
    }

    const oldIndex = orderedGuests.findIndex((guest) => guest.id === active.id);
    const newIndex = orderedGuests.findIndex((guest) => guest.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const nextGuests = arrayMove(orderedGuests, oldIndex, newIndex);

    setOrderedGuests(nextGuests);
    setMessage("Saving row order...");

    startTransition(() => {
      void reorderGuestRows(nextGuests.map((guest) => guest.id))
        .then((result) => {
          setMessage(result.message);

          if (!result.ok) {
            setOrderedGuests(guests);
          }
        })
        .catch(() => {
          setOrderedGuests(guests);
          setMessage("Row order could not be saved.");
        });
    });
  }

  const table = (
    <table className="w-full min-w-[92rem] border-collapse text-left text-xs">
      <thead className="sticky top-0 z-10 bg-[#eca8c0] text-[0.65rem] uppercase tracking-[0.08em] text-[#651735]">
        <tr>
          <th className="w-28 border-r border-b border-[#df7fa3] px-2 py-1.5 font-semibold">
            <SortHeader
              label="Order"
              sortKey="default"
              activeSortKey={activeSortKey}
              activeDirection={activeDirection}
            />
          </th>
          <th className="border-r border-b border-[#df7fa3] px-2 py-1.5 font-semibold">
            <SortHeader
              label="Name"
              sortKey="name"
              activeSortKey={activeSortKey}
              activeDirection={activeDirection}
            />
          </th>
          <th className="border-r border-b border-[#df7fa3] px-2 py-1.5 font-semibold">URL</th>
          <th className="border-r border-b border-[#df7fa3] px-2 py-1.5 font-semibold">Notes</th>
          <th className="w-16 border-r border-b border-[#df7fa3] px-2 py-1.5 text-right font-semibold">
            <SortHeader
              label="Max"
              sortKey="max"
              activeSortKey={activeSortKey}
              activeDirection={activeDirection}
              className="justify-end"
            />
          </th>
          <th className="w-24 border-r border-b border-[#df7fa3] px-2 py-1.5 text-center font-semibold">
            <SortHeader
              label="Invite sent"
              sortKey="invite"
              activeSortKey={activeSortKey}
              activeDirection={activeDirection}
              className="justify-center"
            />
          </th>
          <th className="w-36 border-r border-b border-[#df7fa3] px-2 py-1.5 font-semibold">
            <SortHeader
              label="RSVP"
              sortKey="rsvp"
              activeSortKey={activeSortKey}
              activeDirection={activeDirection}
            />
          </th>
          <th className="w-24 border-r border-b border-[#df7fa3] px-2 py-1.5 text-right font-semibold">
            <SortHeader
              label="Attending"
              sortKey="attending"
              activeSortKey={activeSortKey}
              activeDirection={activeDirection}
              className="justify-end"
            />
          </th>
          <th className="border-r border-b border-[#df7fa3] px-2 py-1.5 font-semibold">Place cards</th>
          <th className="w-40 border-b border-[#df7fa3] px-2 py-1.5 font-semibold">Actions</th>
        </tr>
      </thead>
      <tbody>
        {orderedGuests.length === 0 ? (
          <tr>
            <td className="border-r border-b border-[#efb5c9] px-2 py-1 font-mono text-[0.7rem] text-[#8f5070]">
              1
            </td>
            <td colSpan={9} className="border-b border-[#efb5c9] px-2 py-6 text-center text-sm text-[#8f5070]">
              No guests have been added yet.
            </td>
          </tr>
        ) : (
          <>
            {message ? (
              <tr>
                <td
                  colSpan={10}
                  className={clsx(
                    "border-b border-[#efb5c9] px-2 py-1 text-[0.68rem] font-semibold",
                    message.includes("could not") || message.includes("Refresh")
                      ? "text-[#be123c]"
                      : "text-[#8f2448]",
                  )}
                  role="status"
                >
                  {message}
                </td>
              </tr>
            ) : null}
            {orderedGuests.map((guest, index) =>
              isDefaultSort ? (
                <SortableGuestRow
                  key={guest.id}
                  guest={guest}
                  rowNumber={index + 1}
                  isSaving={isSaving}
                />
              ) : (
                <GuestRow key={guest.id} guest={guest} rowNumber={index + 1} />
              ),
            )}
          </>
        )}
      </tbody>
    </table>
  );

  if (!isDefaultSort) {
    return table;
  }

  return (
    <DndContext
      id="admin-guest-reorder"
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={orderedGuests.map((guest) => guest.id)}
        strategy={verticalListSortingStrategy}
      >
        {table}
      </SortableContext>
    </DndContext>
  );
}
