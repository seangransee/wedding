import assert from "node:assert/strict";
import test from "node:test";
import { calculateRsvpSummaryCounts } from "./rsvp-summary.ts";

test("counts actual yes attendees and full maybe or no-response invitations", () => {
  const guests = [
    { guestCount: 2, rsvpStatus: "yes", attendingCount: 1 },
    { guestCount: 4, rsvpStatus: "yes", attendingCount: 3 },
    { guestCount: 2, rsvpStatus: "deciding", attendingCount: null },
    { guestCount: 5, rsvpStatus: null, attendingCount: null },
    { guestCount: 6, rsvpStatus: "no", attendingCount: null },
  ] as const;

  assert.deepEqual(calculateRsvpSummaryCounts(guests), {
    yesCount: 4,
    yesMaybeCount: 6,
    yesMaybeNoResponseCount: 11,
    friDinnerCount: 0,
  });
});

test("counts Friday dinner using attendees for yes and max for deciding/no-response", () => {
  const guests = [
    // yes + friDin -> counts attendingCount (2)
    { guestCount: 4, rsvpStatus: "yes", attendingCount: 2, friDin: true },
    // deciding + friDin -> counts guestCount (3)
    { guestCount: 3, rsvpStatus: "deciding", attendingCount: null, friDin: true },
    // no response + friDin -> counts guestCount (5)
    { guestCount: 5, rsvpStatus: null, attendingCount: null, friDin: true },
    // no + friDin -> contributes nothing
    { guestCount: 6, rsvpStatus: "no", attendingCount: null, friDin: true },
    // yes without friDin -> excluded from Friday dinner
    { guestCount: 2, rsvpStatus: "yes", attendingCount: 2, friDin: false },
  ] as const;

  assert.deepEqual(calculateRsvpSummaryCounts(guests), {
    yesCount: 4,
    yesMaybeCount: 7,
    yesMaybeNoResponseCount: 12,
    friDinnerCount: 10,
  });
});
