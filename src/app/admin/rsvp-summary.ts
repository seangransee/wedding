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
