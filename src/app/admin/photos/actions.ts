"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, ADMIN_PASSWORD } from "@/lib/cookies";
import {
  reorderWeddingPhotos,
  updateWeddingPhotoHidden,
} from "@/lib/db";
import {
  getCurrentWeddingPhotoFilenames,
  isKnownWeddingPhotoFilename,
} from "@/lib/photos";
import type { AdminActionState } from "../actions";

async function requireAdmin() {
  const cookieStore = await cookies();

  if (cookieStore.get(ADMIN_COOKIE_NAME)?.value !== ADMIN_PASSWORD) {
    throw new Error("Admin login required.");
  }
}

function sameFilenameSet(first: string[], second: string[]) {
  if (first.length !== second.length) {
    return false;
  }

  const remaining = new Set(first);

  for (const filename of second) {
    if (!remaining.delete(filename)) {
      return false;
    }
  }

  return remaining.size === 0;
}

function revalidatePhotoViews() {
  revalidatePath("/");
  revalidatePath("/admin/photos");
}

export async function reorderPhotoRows(filenames: string[]): Promise<AdminActionState> {
  await requireAdmin();

  if (
    filenames.length === 0 ||
    filenames.some((filename) => !isKnownWeddingPhotoFilename(filename))
  ) {
    return { ok: false, message: "Photo order is invalid." };
  }

  const currentFilenames = await getCurrentWeddingPhotoFilenames();

  if (!sameFilenameSet(currentFilenames, filenames)) {
    return { ok: false, message: "Photo list changed. Refresh and try again." };
  }

  const reordered = await reorderWeddingPhotos(filenames);

  if (!reordered) {
    return { ok: false, message: "Photo order changed. Refresh and try again." };
  }

  revalidatePhotoViews();
  return { ok: true, message: "Photo order saved." };
}

export async function setPhotoHidden(
  filename: string,
  hidden: boolean,
): Promise<AdminActionState> {
  await requireAdmin();

  if (!isKnownWeddingPhotoFilename(filename)) {
    return { ok: false, message: "Photo filename is invalid." };
  }

  const updated = await updateWeddingPhotoHidden(filename, hidden);

  if (!updated) {
    return { ok: false, message: "Photo was not found. Refresh and try again." };
  }

  revalidatePhotoViews();
  return { ok: true, message: hidden ? "Photo hidden." : "Photo restored." };
}
