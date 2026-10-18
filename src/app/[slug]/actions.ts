"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, ADMIN_PASSWORD, GUEST_COOKIE_NAME } from "@/lib/cookies";
import {
  getGuestBySlug,
  saveRsvp,
  type MealType,
  type RsvpAttendeeDetails,
  type RsvpStatus,
} from "@/lib/db";
import {
  EMPTY_MAILING_ADDRESS,
  MAILING_ADDRESS_FIELDS,
  mailingAddressFormName,
  normalizeMailingAddress,
  type MailingAddress,
} from "@/lib/mailing-address";
import { isValidSlug } from "@/lib/slug";

export type RsvpActionState = {
  ok: boolean;
  message: string;
  values: {
    status: RsvpStatus | "";
    attendingCount: number | null;
    attendeeDetails: RsvpAttendeeDetails[];
    mailingAddress: MailingAddress;
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

function mealTypeOrNull(value: string): MealType | null {
  if (value === "beef" || value === "fish" || value === "vegetarian") {
    return value;
  }

  return null;
}

function isValidMealType(value: string) {
  return value === "" || value === "beef" || value === "fish" || value === "vegetarian";
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
  const submittedMealTypes = formData
    .getAll("attendeeMealTypes")
    .map((value) => String(value));
  const submittedDietaryNotes = formData
    .getAll("attendeeDietaryNotes")
    .map((value) => String(value));
  const submittedAttendeeCount = Math.max(
    submittedNames.length,
    submittedMealTypes.length,
    submittedDietaryNotes.length,
  );
  const submittedAttendeeDetails = Array.from(
    { length: submittedAttendeeCount },
    (_, index) => ({
      fullName: submittedNames[index] ?? "",
      mealType: mealTypeOrNull(submittedMealTypes[index] ?? ""),
      dietaryNotes: submittedDietaryNotes[index] ?? "",
    }),
  );
  const mailingAddress = normalizeMailingAddress(
    Object.fromEntries(
      MAILING_ADDRESS_FIELDS.map((field) => [
        field,
        String(formData.get(mailingAddressFormName(field)) ?? ""),
      ]),
    ) as MailingAddress,
  );
  const values: RsvpActionState["values"] = {
    status: status === "yes" || status === "no" || status === "deciding" ? status : "",
    attendingCount: rawCount ? Number(rawCount) : null,
    attendeeDetails: submittedAttendeeDetails,
    mailingAddress,
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
      attendeeDetails: [],
      mailingAddress: EMPTY_MAILING_ADDRESS,
    });
  }

  if (status !== "yes") {
    await saveRsvp({
      guestId: guest.id,
      status,
      attendingCount: null,
      attendeeDetails: [],
      mailingAddress,
    });

    revalidatePath(`/${slug}`);
    return stateWithValues("Saved.", true, {
      status,
      attendingCount: null,
      attendeeDetails: [],
      mailingAddress,
    });
  }

  const attendingCount = Number(rawCount);
  values.attendingCount = Number.isInteger(attendingCount) ? attendingCount : null;

  if (!Number.isInteger(attendingCount) || attendingCount < 1 || attendingCount > guest.guestCount) {
    return stateWithValues(`Choose a count from 1 to ${guest.guestCount}.`, false, values);
  }

  const hasInvalidMealType = Array.from(
    { length: attendingCount },
    (_, index) => String(submittedMealTypes[index] ?? ""),
  ).some((mealType) => !isValidMealType(mealType));

  if (hasInvalidMealType) {
    return stateWithValues("Choose a valid meal type.", false, values);
  }

  const attendeeDetails = Array.from(
    { length: attendingCount },
    (_, index) => ({
      fullName: String(submittedNames[index] ?? ""),
      mealType: mealTypeOrNull(String(submittedMealTypes[index] ?? "")),
      dietaryNotes: String(submittedDietaryNotes[index] ?? ""),
    }),
  );

  await saveRsvp({
    guestId: guest.id,
    status: "yes",
    attendingCount,
    attendeeDetails,
    mailingAddress,
  });

  revalidatePath(`/${slug}`);
  return stateWithValues("Saved.", true, {
    status: "yes",
    attendingCount,
    attendeeDetails,
    mailingAddress,
  });
}
