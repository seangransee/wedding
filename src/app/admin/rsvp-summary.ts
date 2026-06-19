export type RsvpSummaryGuest = {
  guestCount: number;
  rsvpStatus: "yes" | "no" | "deciding" | null;
  attendingCount: number | null;
};

export type RsvpSummaryCounts = {
  yesCount: number;
  yesMaybeCount: number;
  yesMaybeNoResponseCount: number;
};

export function calculateRsvpSummaryCounts(
  guests: readonly RsvpSummaryGuest[],
): RsvpSummaryCounts {
  let yesCount = 0;
  let maybeCount = 0;
  let noResponseCount = 0;

  for (const guest of guests) {
    if (guest.rsvpStatus === "yes") {
      yesCount += guest.attendingCount ?? 0;
    } else if (guest.rsvpStatus === "deciding") {
      maybeCount += guest.guestCount;
    } else if (guest.rsvpStatus === null) {
      noResponseCount += guest.guestCount;
    }
  }

  const yesMaybeCount = yesCount + maybeCount;

  return {
    yesCount,
    yesMaybeCount,
    yesMaybeNoResponseCount: yesMaybeCount + noResponseCount,
  };
}
