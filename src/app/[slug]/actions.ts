"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, ADMIN_PASSWORD, GUEST_COOKIE_NAME } from "@/lib/cookies";
import { getGuestBySlug, saveRsvp, type RsvpStatus } from "@/lib/db";
import { isValidSlug } from "@/lib/slug";

export type RsvpActionState = {
  ok: boolean;
  message: string;
  values: {
    status: RsvpStatus | "";
    attendingCount: number | null;
    attendeeNames: string[];
  };
};

function stateWithValues(
  message: string,
  ok: boolean,
  values: RsvpActionState["values"],
): RsvpActionState {
  return { ok, message, values };
}

async function canSubmitForSlug(slug: string) {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get(ADMIN_COOKIE_NAME)?.value === ADMIN_PASSWORD;
  const guestSlug = cookieStore.get(GUEST_COOKIE_NAME)?.value;

  return isAdmin || guestSlug === slug;
}

export async function autosaveRsvp(
  formData: FormData,
): Promise<RsvpActionState> {
  const slug = String(formData.get("slug") ?? "");
  const status = String(formData.get("status") ?? "") as RsvpStatus;
  const rawCount = String(formData.get("attendingCount") ?? "");
  const submittedNames = formData
    .getAll("attendeeNames")
    .map((value) => String(value));
  const values: RsvpActionState["values"] = {
    status: status === "yes" || status === "no" || status === "deciding" ? status : "",
    attendingCount: rawCount ? Number(rawCount) : null,
    attendeeNames: submittedNames,
  };

  if (!isValidSlug(slug)) {
    return stateWithValues("This invitation link is not valid.", false, values);
  }

  if (!(await canSubmitForSlug(slug))) {
    return stateWithValues("Open your invitation link before saving an RSVP.", false, values);
  }

  const guest = await getGuestBySlug(slug);
  if (!guest) {
    return stateWithValues("This invitation link was not found.", false, values);
  }

  if (status !== "yes" && status !== "no" && status !== "deciding") {
    return stateWithValues("Choose an RSVP option.", false, values);
  }

  if (guest.fuckYes && status !== "yes") {
    return stateWithValues("Choose an RSVP option.", false, {
      status: "",
      attendingCount: null,
      attendeeNames: [],
    });
  }

  if (status !== "yes") {
    await saveRsvp({
      guestId: guest.id,
      status,
      attendingCount: null,
      attendeeNames: [],
    });

    revalidatePath(`/${slug}`);
    return stateWithValues("Saved.", true, {
      status,
      attendingCount: null,
      attendeeNames: [],
    });
  }

  const attendingCount = Number(rawCount);
  values.attendingCount = Number.isInteger(attendingCount) ? attendingCount : null;

  if (!Number.isInteger(attendingCount) || attendingCount < 1 || attendingCount > guest.guestCount) {
    return stateWithValues(`Choose a count from 1 to ${guest.guestCount}.`, false, values);
  }

  const attendeeNames = Array.from(
    { length: attendingCount },
    (_, index) => String(submittedNames[index] ?? ""),
  );

  await saveRsvp({
    guestId: guest.id,
    status: "yes",
    attendingCount,
    attendeeNames,
  });

  revalidatePath(`/${slug}`);
  return stateWithValues("Saved.", true, {
    status: "yes",
    attendingCount,
    attendeeNames,
  });
}
