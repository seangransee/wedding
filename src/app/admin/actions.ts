"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, ADMIN_PASSWORD, cookieOptions } from "@/lib/cookies";
import {
  createGuest,
  deleteGuestById,
  reorderGuestsInDefaultSort,
  updateGuestCount,
  updateGuestInviteSent,
  updateGuestName,
  updateGuestNotes,
  updateGuestSlug,
} from "@/lib/db";
import { isValidSlug, slugify } from "@/lib/slug";

export type AdminActionState = {
  ok: boolean;
  message: string;
};

async function isAdminLoggedIn() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE_NAME)?.value === ADMIN_PASSWORD;
}

async function requireAdmin() {
  if (!(await isAdminLoggedIn())) {
    throw new Error("Admin login required.");
  }
}

export async function loginAdmin(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const password = String(formData.get("password") ?? "");

  if (password !== ADMIN_PASSWORD) {
    return {
      ok: false,
      message: "That password is not right.",
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, ADMIN_PASSWORD, cookieOptions());
  redirect("/admin");
}

export async function addGuest(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const slug = slugify(rawSlug);
  const guestCount = Number(formData.get("guestCount"));

  if (!name) {
    return { ok: false, message: "Name is required." };
  }

  if (!slug) {
    return { ok: false, message: "URL slug is required." };
  }

  if (!isValidSlug(slug)) {
    return {
      ok: false,
      message: "URL slug can only contain lowercase letters, numbers, and single dashes.",
    };
  }

  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 10) {
    return { ok: false, message: "Guest count must be between 1 and 10." };
  }

  try {
    await createGuest({ name, notes, slug, guestCount });
  } catch (error) {
    if (error instanceof Error && /duplicate key|unique/i.test(error.message)) {
      return { ok: false, message: "That URL slug is already in use." };
    }

    throw error;
  }

  revalidatePath("/admin");
  return { ok: true, message: `Added ${name}.` };
}

export async function deleteGuest(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const guestId = Number(formData.get("guestId"));
  const confirmation = String(formData.get("confirmation") ?? "");

  if (!Number.isInteger(guestId) || guestId < 1) {
    return { ok: false, message: "Guest id is invalid." };
  }

  if (confirmation !== "delete") {
    return { ok: false, message: 'Type "delete" to confirm.' };
  }

  const deleted = await deleteGuestById(guestId);

  if (!deleted) {
    return { ok: false, message: "Guest was already deleted." };
  }

  revalidatePath("/admin");
  redirect("/admin");
}

export async function setInviteSent(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const guestId = Number(formData.get("guestId"));
  const inviteSent = String(formData.get("inviteSent") ?? "") === "true";

  if (!Number.isInteger(guestId) || guestId < 1) {
    return { ok: false, message: "Guest id is invalid." };
  }

  const updated = await updateGuestInviteSent(guestId, inviteSent);

  if (!updated) {
    return { ok: false, message: "Guest was not found." };
  }

  revalidatePath("/admin");
  return { ok: true, message: inviteSent ? "Invite marked sent." : "Invite marked unsent." };
}

export async function editGuestName(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const guestId = Number(formData.get("guestId"));
  const slug = String(formData.get("slug") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!Number.isInteger(guestId) || guestId < 1) {
    return { ok: false, message: "Guest id is invalid." };
  }

  if (!isValidSlug(slug)) {
    return { ok: false, message: "Guest URL is invalid." };
  }

  if (!name) {
    return { ok: false, message: "Name is required." };
  }

  const updated = await updateGuestName(guestId, name);

  if (!updated) {
    return { ok: false, message: "Guest was not found." };
  }

  revalidatePath("/admin");
  revalidatePath(`/${slug}`);
  return { ok: true, message: "Name saved." };
}

export async function editGuestCount(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const guestId = Number(formData.get("guestId"));
  const slug = String(formData.get("slug") ?? "");
  const guestCount = Number(formData.get("guestCount"));

  if (!Number.isInteger(guestId) || guestId < 1) {
    return { ok: false, message: "Guest id is invalid." };
  }

  if (!isValidSlug(slug)) {
    return { ok: false, message: "Guest URL is invalid." };
  }

  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 10) {
    return { ok: false, message: "Guest count must be between 1 and 10." };
  }

  const updated = await updateGuestCount(guestId, guestCount);

  if (!updated) {
    return { ok: false, message: "Guest was not found." };
  }

  revalidatePath("/admin");
  revalidatePath(`/${slug}`);
  return { ok: true, message: "Max guests saved." };
}

export async function editGuestNotes(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const guestId = Number(formData.get("guestId"));
  const notes = String(formData.get("notes") ?? "").trim();

  if (!Number.isInteger(guestId) || guestId < 1) {
    return { ok: false, message: "Guest id is invalid." };
  }

  const updated = await updateGuestNotes(guestId, notes);

  if (!updated) {
    return { ok: false, message: "Guest was not found." };
  }

  revalidatePath("/admin");
  return { ok: true, message: "Notes saved." };
}

export async function editGuestSlug(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const guestId = Number(formData.get("guestId"));
  const oldSlug = String(formData.get("oldSlug") ?? "");
  const slug = slugify(String(formData.get("slug") ?? ""));

  if (!Number.isInteger(guestId) || guestId < 1) {
    return { ok: false, message: "Guest id is invalid." };
  }

  if (!isValidSlug(oldSlug)) {
    return { ok: false, message: "Current guest URL is invalid." };
  }

  if (!slug) {
    return { ok: false, message: "URL slug is required." };
  }

  if (!isValidSlug(slug)) {
    return {
      ok: false,
      message: "URL slug can only contain lowercase letters, numbers, and single dashes.",
    };
  }

  try {
    const result = await updateGuestSlug(guestId, slug);

    if (result === "invite_sent") {
      return { ok: false, message: "URL cannot be changed after invite sent is checked." };
    }

    if (result === "not_found") {
      return { ok: false, message: "Guest was not found." };
    }
  } catch (error) {
    if (error instanceof Error && /duplicate key|unique/i.test(error.message)) {
      return { ok: false, message: "That URL slug is already in use." };
    }

    throw error;
  }

  revalidatePath("/admin");
  revalidatePath(`/${oldSlug}`);
  revalidatePath(`/${slug}`);
  return { ok: true, message: "URL saved." };
}

export async function reorderGuestRows(guestIds: number[]): Promise<AdminActionState> {
  await requireAdmin();

  if (
    guestIds.length === 0 ||
    guestIds.some((guestId) => !Number.isInteger(guestId) || guestId < 1)
  ) {
    return { ok: false, message: "Guest order is invalid." };
  }

  const reordered = await reorderGuestsInDefaultSort(guestIds);

  if (!reordered) {
    return { ok: false, message: "Guest order changed. Refresh and try again." };
  }

  revalidatePath("/admin");
  return { ok: true, message: "Row order saved." };
}
