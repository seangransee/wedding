export type RsvpSummaryGuest = {
  guestCount: number;
  rsvpStatus: "yes" | "no" | "deciding" | null;
  attendingCount: number | null;
  friDin?: boolean;
};

export type RsvpSummaryCounts = {
  yesCount: number;
  yesMaybeCount: number;
  yesMaybeNoResponseCount: number;
  friDinnerCount: number;
};

export function calculateRsvpSummaryCounts(
  guests: readonly RsvpSummaryGuest[],
): RsvpSummaryCounts {
  let yesCount = 0;
  let maybeCount = 0;
  let noResponseCount = 0;
  let friDinnerCount = 0;

  for (const guest of guests) {
    if (guest.rsvpStatus === "yes") {
      yesCount += guest.attendingCount ?? 0;
    } else if (guest.rsvpStatus === "deciding") {
      maybeCount += guest.guestCount;
    } else if (guest.rsvpStatus === null) {
      noResponseCount += guest.guestCount;
    }

    // Friday dinner: for guests flagged for Fri Din, count actual attendees
    // when they've said yes, otherwise the invitation's max (deciding / no
    // response). Guests who declined ("no") contribute nothing.
    if (guest.friDin) {
      if (guest.rsvpStatus === "yes") {
        friDinnerCount += guest.attendingCount ?? 0;
      } else if (guest.rsvpStatus === "deciding" || guest.rsvpStatus === null) {
        friDinnerCount += guest.guestCount;
      }
    }
  }

  const yesMaybeCount = yesCount + maybeCount;

  return {
    yesCount,
    yesMaybeCount,
    yesMaybeNoResponseCount: yesMaybeCount + noResponseCount,
    friDinnerCount,
  };
}

export type IncompleteGuestInput = {
  id: number;
  rsvpStatus: "yes" | "no" | "deciding" | null;
  attendingCount: number | null;
  attendeeDetails: readonly {
    fullName: string;
    mealType: string | null;
  }[];
};

export type MissingAttendeeDetails = {
  position: number;
  fullName: string;
  missingName: boolean;
  missingMeal: boolean;
};

export type IncompleteRsvps<T> = {
  // No RSVP saved yet, or still deciding.
  awaitingResponse: T[];
  // Said yes, but at least one attending person lacks a place-card name or meal.
  missingDetails: { guest: T; attendees: MissingAttendeeDetails[] }[];
};

// Attendee rows are stored in position order and only when some detail was
// entered, so slots past the stored rows are entirely blank.
export function findIncompleteRsvps<T extends IncompleteGuestInput>(
  guests: readonly T[],
): IncompleteRsvps<T> {
  const awaitingResponse: T[] = [];
  const missingDetails: IncompleteRsvps<T>["missingDetails"] = [];

  for (const guest of guests) {
    if (guest.rsvpStatus === null || guest.rsvpStatus === "deciding") {
      awaitingResponse.push(guest);
      continue;
    }
    if (guest.rsvpStatus !== "yes") {
      continue;
    }

    const attendees: MissingAttendeeDetails[] = [];
    for (let index = 0; index < (guest.attendingCount ?? 0); index += 1) {
      const attendee = guest.attendeeDetails[index];
      const fullName = attendee?.fullName.trim() ?? "";
      const missingName = fullName === "";
      const missingMeal = !attendee?.mealType;
      if (missingName || missingMeal) {
        attendees.push({ position: index + 1, fullName, missingName, missingMeal });
      }
    }

    if (attendees.length > 0) {
      missingDetails.push({ guest, attendees });
    }
  }

  return { awaitingResponse, missingDetails };
}
